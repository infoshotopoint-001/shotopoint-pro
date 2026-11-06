<?php
/* Include this helper in the public Newsroom PHP page.
   It reads the administrator's live Newsfeed Settings from Node/MySQL. */
function shoto_newsroom_config(): array {
    $base = getenv('SHOTO_API_BASE') ?: '/api';
    $url = rtrim($base,'/').'/public/newsroom-config';
    $json = @file_get_contents($url);
    if ($json === false) return ['settings'=>null,'categories'=>[],'featured'=>[]];
    $data = json_decode($json,true);
    return is_array($data['data'] ?? null) ? $data['data'] : ['settings'=>null,'categories'=>[],'featured'=>[]];
}
