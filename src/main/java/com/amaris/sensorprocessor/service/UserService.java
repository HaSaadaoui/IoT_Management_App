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

}
