<?php
/*
|--------------------------------------------------------------------------
| SHOTO POINT PRODUCTIONS
| Team Management API
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";


/*
|--------------------------------------------------------------------------
| Helper: JSON Response
|--------------------------------------------------------------------------
*/

function jsonResponse(
    bool $success,
    string $message = "",
    $data = null,
    int $statusCode = 200
): void {

    http_response_code($statusCode);

    echo json_encode(
        [
            "success" => $success,
            "message" => $message,
            "data"    => $data
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES |
        JSON_PRETTY_PRINT
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Request Method
|--------------------------------------------------------------------------
*/

$method = $_SERVER["REQUEST_METHOD"];


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
| Returns published team members for the public website.
|
| Optional:
|
| ?all=1
|
| returns published + unpublished records.
|--------------------------------------------------------------------------
*/

if ($method === "GET") {

    try {

        $showAll = isset($_GET["all"]) && $_GET["all"] === "1";

        if ($showAll) {

            $sql = "
                SELECT
                    id,
                    team_group,
                    role,
                    name,
                    short_bio,
                    biography,
                    image_url,
                    display_order,
                    is_published,
                    created_at,
                    updated_at
                FROM team_members
                ORDER BY display_order ASC, id ASC
            ";

            $stmt = $pdo->prepare($sql);

        } else {

            $sql = "
                SELECT
                    id,
                    team_group,
                    role,
                    name,
                    short_bio,
                    biography,
                    image_url,
                    display_order,
                    is_published,
                    created_at,
                    updated_at
                FROM team_members
                WHERE is_published = 1
                ORDER BY display_order ASC, id ASC
            ";

            $stmt = $pdo->prepare($sql);
        }

        $stmt->execute();

        $members = $stmt->fetchAll();

        jsonResponse(
            true,
            "Team members loaded successfully.",
            $members
        );

    } catch (PDOException $e) {

        jsonResponse(
            false,
            "Unable to load team members.",
            null,
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
| Creates a new team member.
|--------------------------------------------------------------------------
*/

if ($method === "POST") {

    $input = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($input)) {
        $input = $_POST;
    }

    $teamGroup = trim($input["team_group"] ?? "");
    $role      = trim($input["role"] ?? "");
    $name      = trim($input["name"] ?? "");
    $shortBio  = trim($input["short_bio"] ?? "");
    $biography = trim($input["biography"] ?? "");
    $imageUrl  = trim($input["image_url"] ?? "");
    $order     = (int)($input["display_order"] ?? 0);
    $published = (int)($input["is_published"] ?? 1);

    if ($teamGroup === "") {

        jsonResponse(
            false,
            "Team group is required.",
            null,
            400
        );
    }

    if ($role === "") {

        jsonResponse(
            false,
            "Role / Position is required.",
            null,
            400
        );
    }

    if ($name === "") {

        jsonResponse(
            false,
            "Name is required.",
            null,
            400
        );
    }

    $published = $published === 1 ? 1 : 0;

    try {

        $sql = "
            INSERT INTO team_members
            (
                team_group,
                role,
                name,
                short_bio,
                biography,
                image_url,
                display_order,
                is_published
            )
            VALUES
            (
                :team_group,
                :role,
                :name,
                :short_bio,
                :biography,
                :image_url,
                :display_order,
                :is_published
            )
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute(
            [
                ":team_group"   => $teamGroup,
                ":role"         => $role,
                ":name"         => $name,
                ":short_bio"    => $shortBio,
                ":biography"    => $biography,
                ":image_url"    => $imageUrl,
                ":display_order"=> $order,
                ":is_published" => $published
            ]
        );

        $id = $pdo->lastInsertId();

        $stmt = $pdo->prepare(
            "SELECT * FROM team_members WHERE id = ?"
        );

        $stmt->execute([$id]);

        $member = $stmt->fetch();

        jsonResponse(
            true,
            "Team member created successfully.",
            $member,
            201
        );

    } catch (PDOException $e) {

        jsonResponse(
            false,
            "Unable to create team member.",
            null,
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| PUT
|--------------------------------------------------------------------------
| Updates an existing team member.
|--------------------------------------------------------------------------
*/

if ($method === "PUT") {

    $id = isset($_GET["id"])
        ? (int)$_GET["id"]
        : 0;

    if ($id <= 0) {

        jsonResponse(
            false,
            "A valid team member ID is required.",
            null,
            400
        );
    }

    $input = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($input)) {

        jsonResponse(
            false,
            "Invalid request data.",
            null,
            400
        );
    }

    $teamGroup = trim($input["team_group"] ?? "");
    $role      = trim($input["role"] ?? "");
    $name      = trim($input["name"] ?? "");
    $shortBio  = trim($input["short_bio"] ?? "");
    $biography = trim($input["biography"] ?? "");
    $imageUrl  = trim($input["image_url"] ?? "");
    $order     = (int)($input["display_order"] ?? 0);
    $published = (int)($input["is_published"] ?? 1);

    if ($teamGroup === "" || $role === "" || $name === "") {

        jsonResponse(
            false,
            "Team group, role and name are required.",
            null,
            400
        );
    }

    $published = $published === 1 ? 1 : 0;

    try {

        $sql = "
            UPDATE team_members
            SET
                team_group = :team_group,
                role = :role,
                name = :name,
                short_bio = :short_bio,
                biography = :biography,
                image_url = :image_url,
                display_order = :display_order,
                is_published = :is_published
            WHERE id = :id
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute(
            [
                ":team_group"    => $teamGroup,
                ":role"          => $role,
                ":name"          => $name,
                ":short_bio"     => $shortBio,
                ":biography"     => $biography,
                ":image_url"     => $imageUrl,
                ":display_order" => $order,
                ":is_published"  => $published,
                ":id"            => $id
            ]
        );

        $stmt = $pdo->prepare(
            "SELECT * FROM team_members WHERE id = ?"
        );

        $stmt->execute([$id]);

        $member = $stmt->fetch();

        if (!$member) {

            jsonResponse(
                false,
                "Team member not found.",
                null,
                404
            );
        }

        jsonResponse(
            true,
            "Team member updated successfully.",
            $member
        );

    } catch (PDOException $e) {

        jsonResponse(
            false,
            "Unable to update team member.",
            null,
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

if ($method === "DELETE") {

    $id = isset($_GET["id"])
        ? (int)$_GET["id"]
        : 0;

    if ($id <= 0) {

        jsonResponse(
            false,
            "A valid team member ID is required.",
            null,
            400
        );
    }

    try {

        $stmt = $pdo->prepare(
            "DELETE FROM team_members WHERE id = ?"
        );

        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {

            jsonResponse(
                false,
                "Team member not found.",
                null,
                404
            );
        }

        jsonResponse(
            true,
            "Team member deleted successfully."
        );

    } catch (PDOException $e) {

        jsonResponse(
            false,
            "Unable to delete team member.",
            null,
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| Unsupported Method
|--------------------------------------------------------------------------
*/

jsonResponse(
    false,
    "Request method not supported.",
    null,
    405
);