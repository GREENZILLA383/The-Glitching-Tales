Set-Location "C:\Users\ibrah\OneDrive\Desktop\oyun"
New-Item -ItemType Directory -Force -Path "SnakeGame" | Out-Null
Set-Location "SnakeGame"
npx create-expo-app . --template blank
Copy-Item "..\App.js" -Destination ".\App.js" -Force
npx expo start
