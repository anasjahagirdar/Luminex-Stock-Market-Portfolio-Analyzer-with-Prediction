from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Set


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?',
        (table_name,),
    ).fetchone()
    return row is not None


def get_columns(conn: sqlite3.Connection, table_name: str) -> Set[str]:
    rows = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    return {r[1] for r in rows}


def infer_market(symbol: Optional[str]) -> str:
    s = (symbol or '').upper().strip()
    if s.endswith('.BSE') or s.endswith('.NSE'):
        return 'india'
    return 'international'


def ensure_default_portfolio(conn: sqlite3.Connection, user_id: int, now_iso: str) -> int:
    row = conn.execute(
        """
        SELECT id
        FROM portfolios
        WHERE user_id = ? AND name = 'My Portfolio'
        ORDER BY id ASC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    if row:
        return int(row[0])

    row = conn.execute(
        """
        SELECT id
        FROM portfolios
        WHERE user_id = ?
        ORDER BY id ASC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    if row:
        return int(row[0])

    cur = conn.execute(
        """
        INSERT INTO portfolios (user_id, name, created_at, updated_at)
        VALUES (?, 'My Portfolio', ?, ?)
        """,
        (user_id, now_iso, now_iso),
    )
    return int(cur.lastrowid)


def migrate_portfolio_items(conn: sqlite3.Connection) -> None:
    if not table_exists(conn, 'portfolio_items'):
        print('No portfolio_items table found. Nothing to migrate.')
        return

    if not table_exists(conn, 'portfolios'):
        raise RuntimeError('portfolios table is missing. Cannot map portfolio_id safely.')

    cols = get_columns(conn, 'portfolio_items')
    required = {'id', 'symbol', 'name', 'quantity', 'avg_buy_price'}
    missing_required = required - cols
    if missing_required:
        raise RuntimeError(
            f'portfolio_items missing required columns: {sorted(missing_required)}'
        )

    has_portfolio_id = 'portfolio_id' in cols
    has_market = 'market' in cols
    has_user_id = 'user_id' in cols

    if has_portfolio_id and has_market:
        print('portfolio_items already has portfolio_id and market. Migration not required.')
        return

    print('Starting migration for portfolio_items...')
    print(f'Existing columns: {sorted(cols)}')

    now_iso = datetime.now(timezone.utc).isoformat()

    select_parts = [
        'id',
        'portfolio_id' if has_portfolio_id else 'NULL AS portfolio_id',
        'user_id' if has_user_id else 'NULL AS user_id',
        'symbol',
        'name',
        'quantity',
        'avg_buy_price',
        'sector' if 'sector' in cols else 'NULL AS sector',
        'market' if has_market else 'NULL AS market',
        'created_at' if 'created_at' in cols else 'NULL AS created_at',
    ]

    rows = conn.execute(
        f"""
        SELECT {", ".join(select_parts)}
        FROM portfolio_items
        ORDER BY id ASC
        """
    ).fetchall()

    user_to_portfolio: Dict[int, int] = {}
    if has_user_id:
        user_ids = sorted({int(r[2]) for r in rows if r[2] is not None})
        for uid in user_ids:
            user_to_portfolio[uid] = ensure_default_portfolio(conn, uid, now_iso)

    conn.execute('DROP TABLE IF EXISTS portfolio_items_new')

    conn.execute(
        """
        CREATE TABLE portfolio_items_new (
            id INTEGER PRIMARY KEY,
            portfolio_id INTEGER NOT NULL,
            user_id INTEGER,
            symbol VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            quantity FLOAT NOT NULL,
            avg_buy_price FLOAT NOT NULL,
            sector VARCHAR,
            market VARCHAR,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (portfolio_id) REFERENCES portfolios (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        """
    )

    inserted = 0
    for r in rows:
        row_id = int(r[0])
        portfolio_id = r[1]
        user_id = r[2]
        symbol = r[3]
        name = r[4]
        quantity = r[5]
        avg_buy_price = r[6]
        sector = r[7]
        market = r[8]
        created_at = r[9]

        if portfolio_id is None:
            if user_id is not None:
                uid = int(user_id)
                if uid not in user_to_portfolio:
                    user_to_portfolio[uid] = ensure_default_portfolio(conn, uid, now_iso)
                portfolio_id = user_to_portfolio[uid]
            else:
                fallback = conn.execute(
                    'SELECT id FROM portfolios ORDER BY id ASC LIMIT 1'
                ).fetchone()
                if not fallback:
                    raise RuntimeError(
                        f'Cannot resolve portfolio_id for portfolio_items.id={row_id}'
                    )
                portfolio_id = int(fallback[0])

        resolved_market = market or infer_market(symbol)
        resolved_created_at = created_at or now_iso

        conn.execute(
            """
            INSERT INTO portfolio_items_new (
                id,
                portfolio_id,
                user_id,
                symbol,
                name,
                quantity,
                avg_buy_price,
                sector,
                market,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row_id,
                int(portfolio_id),
                int(user_id) if user_id is not None else None,
                symbol,
                name,
                quantity,
                avg_buy_price,
                sector,
                resolved_market,
                resolved_created_at,
            ),
        )
        inserted += 1

    conn.execute('DROP TABLE portfolio_items')
    conn.execute('ALTER TABLE portfolio_items_new RENAME TO portfolio_items')

    conn.execute(
        'CREATE INDEX IF NOT EXISTS ix_portfolio_items_portfolio_id ON portfolio_items (portfolio_id)'
    )
    conn.execute(
        'CREATE INDEX IF NOT EXISTS ix_portfolio_items_user_id ON portfolio_items (user_id)'
    )
    conn.execute(
        'CREATE INDEX IF NOT EXISTS ix_portfolio_items_symbol ON portfolio_items (symbol)'
    )

    new_cols = get_columns(conn, 'portfolio_items')
    print(f'Migration complete. Rows copied: {inserted}')
    print(f'New columns: {sorted(new_cols)}')


def main() -> None:
    default_db = Path(__file__).resolve().parents[1] / 'luminex.db'

    parser = argparse.ArgumentParser(
        description='Migrate portfolio_items to include portfolio_id + market (SQLite-safe table recreation).'
    )
    parser.add_argument(
        '--db',
        type=str,
        default=str(default_db),
        help='Path to SQLite DB file (default: backend/luminex.db).',
    )
    args = parser.parse_args()

    db_path = Path(args.db).resolve()
    if not db_path.exists():
        raise FileNotFoundError(f'Database file not found: {db_path}')

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute('PRAGMA foreign_keys=OFF')
        conn.execute('BEGIN IMMEDIATE')
        migrate_portfolio_items(conn)
        conn.commit()
        print(f'Committed migration on: {db_path}')
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.close()


if __name__ == '__main__':
    main()
