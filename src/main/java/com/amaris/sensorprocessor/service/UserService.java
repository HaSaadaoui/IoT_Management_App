package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.repository.UserDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserDao userDao;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public UserService(UserDao userDao, PasswordEncoder passwordEncoder) {
        this.userDao = userDao;
        this.passwordEncoder = passwordEncoder;
    }


    public List<User> getAllUsers() {
        return userDao.findAllUsers();
    }

    public int save(User user) {
        if (!userDao.findByUsername(user.getUsername()).isEmpty()) {
            throw new CustomException("User already exists");
        }
        // Encoder le mot de passe avant sauvegarde
        String encodedPassword = passwordEncoder.encode(user.getPassword());
        user.setPassword(encodedPassword);

        return userDao.insertUser(user);
    }

    public int deleteUser(String username) {
        return userDao.deleteByIdOfUser(username);
    }

    public User searchUserByUsername(String username) {
        Optional<User> user = userDao.findByUsername(username);
        if (user.isEmpty()) {
            throw new CustomException("User don't exists");
        }
        return user.get();
    }

    public int update(User user) {
        return userDao.updateUser(user);
    }

    public void changePassword(String username, String currentPassword, String newPassword) {
        User user = searchUserByUsername(username);

        // Vérifie mot de passe actuel
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Mot de passe actuel incorrect.");
        }

        // Vérifie la complexité du nouveau mot de passe
        if (newPassword.length() < 8) {
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins 8 caractères.");
        }
        if (!newPassword.matches(".*[A-Z].*") || !newPassword.matches(".*[0-9].*")) {
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins une majuscule et un chiffre.");
        }

        // Hash et sauvegarde
        user.setPassword(passwordEncoder.encode(newPassword));
        userDao.updatePassword(username, passwordEncoder.encode(newPassword));
    }

}
