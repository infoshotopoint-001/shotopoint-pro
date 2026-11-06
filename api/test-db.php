<?php
/**
 * SHOTO POINT PRODUCTIONS
 * Database Connection Test
 *
 * File: test-db.php
 */

declare(strict_types=1);

header('Content-Type: text/html; charset=UTF-8');

// Load the database connection
require_once __DIR__ . '/config/database.php';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Shoto Point — Database Test</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
            font-family: Arial, Helvetica, sans-serif;
            background: #07150f;
            color: #ffffff;
        }

        .test-box {
            width: 100%;
            max-width: 650px;
            padding: 35px;
            border: 1px solid rgba(212, 175, 55, 0.35);
            border-radius: 18px;
            background: #0d2419;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        }

        h1 {
            margin-top: 0;
            color: #d4af37;
            font-size: 28px;
        }

        .status {
            margin: 25px 0;
            padding: 20px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: bold;
        }

        .success {
            background: rgba(34, 139, 84, 0.18);
            border: 1px solid #2fa866;
            color: #7ff0ae;
        }

        .error {
            background: rgba(180, 40, 40, 0.18);
            border: 1px solid #d9534f;
            color: #ff8f8b;
        }

        .details {
            margin-top: 20px;
            padding: 18px;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 10px;
            line-height: 1.8;
        }

        .details strong {
            color: #d4af37;
        }

        code {
            color: #8ff0bd;
        }
    </style>
</head>

<body>

<div class="test-box">

    <h1>SHOTO POINT PRODUCTIONS</h1>

    <p>Database Connection Test</p>

    <?php

    try {

        /*
         * database.php should provide a PDO connection
         * in the variable named $pdo.
         */

        if (!isset($pdo) || !($pdo instanceof PDO)) {

            throw new RuntimeException(
                'The database connection variable $pdo was not created by config/database.php.'
            );
        }

        /*
         * Test the actual MySQL connection.
         */
        $pdo->query('SELECT 1');

        /*
         * Confirm the current database.
         */
        $databaseName = $pdo->query('SELECT DATABASE()')->fetchColumn();

        /*
         * Check whether the team_members table exists.
         */
        $tableCheck = $pdo->prepare("
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_name = 'team_members'
        ");

        $tableCheck->execute([$databaseName]);

        $teamTableExists = (int)$tableCheck->fetchColumn() > 0;
        ?>

        <div class="status success">
            ✓ DATABASE CONNECTION SUCCESSFUL
        </div>

        <div class="details">

            <strong>Database:</strong>
            <code>
                <?= htmlspecialchars((string)$databaseName, ENT_QUOTES, 'UTF-8') ?>
            </code>

            <br>

            <strong>MySQL Connection:</strong>
            Connected

            <br>

            <strong>team_members Table:</strong>
            <?= $teamTableExists ? 'Found ✓' : 'Not Found ✗' ?>

        </div>

        <?php if (!$teamTableExists): ?>

            <div class="status error">
                The database is connected, but the
                <code>team_members</code> table was not found.
            </div>

        <?php endif; ?>

        <?php

    } catch (Throwable $e) {

        ?>

        <div class="status error">
            ✗ DATABASE CONNECTION FAILED
        </div>

        <div class="details">

            <strong>Error:</strong><br>

            <?= htmlspecialchars(
                $e->getMessage(),
                ENT_QUOTES,
                'UTF-8'
            ) ?>

        </div>

        <?php

    }

    ?>

</div>

</body>
</html>