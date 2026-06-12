<?php
// event.php - Dynamic Open Graph generator for Hostinger / Apache environments
$id = isset($_GET['id']) ? $_GET['id'] : '';

$title = "Blithe Event";
$image = "https://blithweb.vercel.app/assets/logo-transparent-88a7d774.png";
$desc = "Check out this event on Blithe!";

if ($id) {
    // Call Firebase REST API to fetch event details
    $url = "https://firestore.googleapis.com/v1/projects/blith-2963e/databases/(default)/documents/event/" . urlencode($id);
    
    // Suppress warnings in case the document doesn't exist or API fails
    $response = @file_get_contents($url);
    
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['fields'])) {
            $fields = $data['fields'];
            
            if (isset($fields['eventName']['stringValue'])) {
                $title = htmlspecialchars($fields['eventName']['stringValue'], ENT_QUOTES, 'UTF-8');
            }
            if (isset($fields['description']['stringValue'])) {
                $desc = htmlspecialchars(substr($fields['description']['stringValue'], 0, 150), ENT_QUOTES, 'UTF-8') . '...';
            }
            if (isset($fields['image']['arrayValue']['values'][0]['stringValue'])) {
                $image = htmlspecialchars($fields['image']['arrayValue']['values'][0]['stringValue'], ENT_QUOTES, 'UTF-8');
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?> | Blithe</title>

    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="<?= $title ?>" />
    <meta property="og:description" content="<?= $desc ?>" />
    <meta property="og:image" content="<?= $image ?>" />
    <meta property="og:image:secure_url" content="<?= $image ?>" />
    <meta property="og:type" content="website" />
    
    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="<?= $title ?>" />
    <meta name="twitter:description" content="<?= $desc ?>" />
    <meta name="twitter:image" content="<?= $image ?>" />

    <script>
        // Humans are instantly redirected back to the React app.
        // We append ?ssr=false so Apache knows not to loop back to this PHP file!
        if (!navigator.userAgent.toLowerCase().includes('whatsapp')) {
            window.location.replace('/events/<?= urlencode($id) ?>?ssr=false');
        }
    </script>
</head>
<body>
    <p>Loading event <?= $title ?>...</p>
</body>
</html>
