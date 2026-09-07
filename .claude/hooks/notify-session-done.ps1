# Toast thông báo khi một phiên Claude Code trong project này kết thúc.
# Gọi từ hook Stop (.claude/settings.local.json). Nhận JSON của hook trên stdin nhưng
# không cần đọc — chỉ báo "xong", nội dung chi tiết đã có trong terminal.
$ErrorActionPreference = 'Stop'

$title = 'Claude Code'
$body  = 'Phiên làm việc đã hoàn thành - massage-platform'

try {
    # AppId phải là một shortcut Start Menu có thật, nếu không toast im lặng không hiện.
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType=WindowsRuntime]

    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
        [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $texts = $template.GetElementsByTagName('text')
    $texts.Item(0).AppendChild($template.CreateTextNode($title))  | Out-Null
    $texts.Item(1).AppendChild($template.CreateTextNode($body))   | Out-Null

    $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
} catch {
    # WinRT không dùng được (Server Core, session không có desktop...) -> balloon tip khay hệ thống.
    Add-Type -AssemblyName System.Windows.Forms
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Information
    $icon.Visible = $true
    $icon.ShowBalloonTip(5000, $title, $body, [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Milliseconds 5000
    $icon.Dispose()
}
