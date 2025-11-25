package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.prediction.PredictionResponse;
import com.amaris.sensorprocessor.service.PredictionClientService;
import com.amaris.sensorprocessor.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.security.Principal;

@Controller
public class PredictionController {

    private final PredictionClientService predictionService;
    private final UserService userService;

    @Autowired
    public PredictionController(PredictionClientService predictionService,
                                UserService userService) {
        this.predictionService = predictionService;
        this.userService = userService;
    }

    /**
     * Page: /prediction
     * Добавляем user + loggedUsername в модель (как в SensorController).
     */
    @GetMapping("/prediction")
    public String predictionPage(Model model, Principal principal) {

        if (principal != null) {
            User user = userService.searchUserByUsername(principal.getName());
            model.addAttribute("user", user);
            model.addAttribute("loggedUsername", user.getUsername());
        }

        return "prediction";
    }

    /**
     * REST: /prediction/realtime/data?horizon=1h|1d|1w|1m|3m
     * Проксируем запрос на FastAPI с выбранным горизонтом.
     */
    @GetMapping("/prediction/realtime/data")
    @ResponseBody
    public PredictionResponse getRealtimePrediction(
            @RequestParam(name = "horizon", defaultValue = "1h") String horizon) {

        return predictionService.getPrediction(horizon);
    }
}
