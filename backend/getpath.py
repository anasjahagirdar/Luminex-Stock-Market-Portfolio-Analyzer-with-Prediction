import subprocess
result = subprocess.run(
    'for %I in ("D:\\Bizmetric\\F.S.D\\Luminex – Stock Market Portfolio Analyzer\\venv\\Lib\\site-packages\\certifi\\cacert.pem") do echo %~sI',
    shell=True,
    capture_output=True,
    text=True
)
print(result.stdout)