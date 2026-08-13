<?php
// event.php - Dynamic Open Graph generator for Hostinger / Apache environments
$id = isset($_GET['id']) ? $_GET['id'] : '';

// -------------------------------------------------------------
// On-the-fly Image Compression Proxy for WhatsApp OG Previews
// -------------------------------------------------------------
if (isset($_GET['img']) && $id) {
    $url = "https://firestore.googleapis.com/v1/projects/blith-2963e/databases/(default)/documents/event/" . urlencode($id);
    $response = @file_get_contents($url);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['fields']['image']['arrayValue']['values'][0]['stringValue'])) {
            $rawImgUrl = $data['fields']['image']['arrayValue']['values'][0]['stringValue'];
            
            // Fetch raw image
            $imgData = @file_get_contents($rawImgUrl);
            if ($imgData && extension_loaded('gd')) {
                $src = @imagecreatefromstring($imgData);
                if ($src) {
                    $width = imagesx($src);
                    $height = imagesy($src);
                    $maxWidth = 800;
                    
                    if ($width > $maxWidth) {
                        $newWidth = $maxWidth;
                        $newHeight = (int)($height * ($newWidth / $width));
                    } else {
                        $newWidth = $width;
                        $newHeight = $height;
                    }
                    
                    $dst = imagecreatetruecolor($newWidth, $newHeight);
                    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    
                    header('Content-Type: image/jpeg');
                    header('Cache-Control: public, max-age=86400');
                    imagejpeg($dst, null, 75);
                    imagedestroy($src);
                    imagedestroy($dst);
                    exit;
                }
            }
            
            // Fallback if GD is missing or image compression failed: redirect to original image
            header("Location: " . $rawImgUrl);
            exit;
        }
    }
    header('Location: https://blithweb.vercel.app/assets/logo-transparent-88a7d774.png');
    exit;
}

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
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
                $host = $_SERVER['HTTP_HOST'] ?? 'blithe.social';
                $image = $protocol . $host . "/events/event.php?img=1&id=" . urlencode($id);
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
