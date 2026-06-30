-- A role may grant multiple permissions. Backs RoleEntity.permissions
-- (@ElementCollection → table role_permissions, FK role_id → roles.id).
CREATE TABLE role_permissions (
    role_id    BIGINT       NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
