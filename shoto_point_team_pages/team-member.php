<?php
$group = isset($_GET['group']) ? (string)$_GET['group'] : '';
$member = isset($_GET['member']) ? (int)$_GET['member'] : -1;
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id > 0) {
    header('Location: team-member.html?id=' . $id, true, 302);
    exit;
}
if (!in_array($group, ['administrative', 'senior'], true) || $member < 0) {
    header('Location: administrative.html', true, 302);
    exit;
}
header('Location: team-biography.html?group=' . rawurlencode($group) . '&member=' . $member, true, 302);
exit;
