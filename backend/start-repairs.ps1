# Starts the repairs intake backend at logon. Restarts it if it ever crashes.
while ($true) {
    Start-Process -FilePath "node" -ArgumentList "repairs-server.js" `
        -WorkingDirectory "D:\CodyNoah.net\backend" `
        -RedirectStandardOutput "D:\CodyNoah.net\backend\repairs-server.log" `
        -RedirectStandardError "D:\CodyNoah.net\backend\repairs-server.err.log" `
        -NoNewWindow -Wait
    Start-Sleep -Seconds 5
}
