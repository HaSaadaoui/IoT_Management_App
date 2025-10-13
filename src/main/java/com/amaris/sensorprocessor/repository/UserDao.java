package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public UserDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Récupère la liste de tous les utilisateurs enregistrés dans la base de données.
     *
     * @return une liste d'objets {@code User} représentant tous les utilisateurs.
     */
    public List<User> findAllUsers() {
        return jdbcTemplate.query(
                "SELECT * FROM USERS ORDER BY LOWER(lastname) ASC;",
                new BeanPropertyRowMapper<User>(User.class));
    }

    /**
     * Recherche un utilisateur par son nom d'utilisateur.
     *
     * @param username l'id de l'utilisateur.
     * @return L'objet User correspondant à l'utilisateur trouvé.
     */
    public Optional<User> findByUsername(String username) {
        List<User> users = jdbcTemplate.query(
                "SELECT * FROM USERS WHERE USERNAME=?",
                new BeanPropertyRowMapper<>(User.class),
                username
        );

        return users.isEmpty() ? Optional.empty() : Optional.of(users.get(0));
    }

    /**
     * Supprime un utilisateur de la base de données en fonction de son identifiant.
     *
     * @param username l'identifiant de l'utilisateur à supprimer
     * @return le nombre de lignes affectées par la suppression (généralement 0 ou 1)
     */
    public int deleteByIdOfUser(String username) {
        return jdbcTemplate.update(
                "DELETE FROM USERS WHERE USERNAME=?",
                username);
    }

    /**
     * Insère un nouvel utilisateur dans la base de données.
     *
     * @param user l'objet {@link User} contenant les informations de l'utilisateur à insérer.
     * @return le nombre de lignes affectées dans la base de données (1 si l'insertion a réussi, 0 sinon).
     */
    public int insertUser(User user) {
        return jdbcTemplate.update(
                "INSERT INTO USERS (" +
                        "USERNAME, FIRSTNAME, LASTNAME, " +
                        "PASSWORD, ROLE, EMAIL, AVATAR) " +
                        "VALUES(?, ?, ?, ?, ?, ?)",
                user.getUsername(), user.getFirstname(), user.getLastname(),
                user.getPassword(), user.getRole(), user.getEmail(), user.getIcon()
        );
    }

    /**
     * Met à jour les informations d'un utilisateur dans la base de données.
     *
     * @param user l'objet {@link User} contenant les nouvelles valeurs à mettre à jour.
     * @return le nombre de lignes affectées par la mise à jour (1 si l'id existe, 0 sinon).
     */
    public int updateUser(User user) {
        return jdbcTemplate.update(
                "UPDATE USERS SET " +
                        "FIRSTNAME = ?, LASTNAME = ?, " +
                        "EMAIL = ?, ROLE = ? " +
                        "WHERE USERNAME = ?",
                user.getFirstname(), user.getLastname(),
                user.getEmail(), user.getRole(), user.getUsername()
        );
    }

    /**
     * Met à jour les informations d'un utilisateur en mode non admin dans la base de données.
     *
     * @param user l'objet {@link User} contenant les nouvelles valeurs à mettre à jour.
     * @return le nombre de lignes affectées par la mise à jour (1 si l'id existe, 0 sinon).
     */

    public int updateUserProfile(User user) {
        return jdbcTemplate.update(
                "UPDATE USERS SET FIRSTNAME = ?, LASTNAME = ?, EMAIL = ? WHERE USERNAME = ?",
                user.getFirstname(),
                user.getLastname(),
                user.getEmail(),
                user.getUsername()
        );
    }

    /**
     * met a jour un utilisateur de la base de données en fonction de son identifiant.
     *
     * @param username l'identifiant de l'utilisateur à mettre à jour
     * @param newPasswordHash mot de passe
     */
    public int updatePassword(String username, String newPasswordHash) {
        return jdbcTemplate.update(
                "UPDATE USERS SET PASSWORD = ? WHERE USERNAME = ?",
                newPasswordHash, username
        );
    }

    /**
     * met a jour un utilisateur de la base de données en fonction de son identifiant.
     *
     * @param username l'identifiant de l'utilisateur à mettre à jour
     * @param avatar url avatar
     */
    public int updateAvatar(String username, String avatar) {
        return jdbcTemplate.update(
                "UPDATE USERS SET ICON = ? WHERE USERNAME = ?",
                avatar, username
        );
    }

}
