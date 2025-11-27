package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.prediction.PredictionResponse;
import com.amaris.sensorprocessor.model.prediction.T0ListResponse;
import com.amaris.sensorprocessor.model.prediction.HistoricalResponse;
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

    @GetMapping("/prediction")
    public String predictionPage(Model model, Principal principal) {
        if (principal != null) {
            User user = userService.searchUserByUsername(principal.getName());
            model.addAttribute("user", user);
            model.addAttribute("loggedUsername", user.getUsername());
        }
        return "prediction";
    }

    @GetMapping("/prediction/realtime/data")
    @ResponseBody
    public PredictionResponse getRealtimePrediction(
            @RequestParam(name = "horizon", defaultValue = "1h") String horizon) {
        return predictionService.getPrediction(horizon);
    }

    // 🔹 СПИСОК t0 ДЛЯ HISTORICAL
    @GetMapping("/prediction/historical/t0-list")
    @ResponseBody
    public T0ListResponse getHistoricalT0List() {
        return predictionService.getHistoricalT0List();
    }

    // 🔹 ДАННЫЕ HISTORICAL ПО ВЫБРАННОМУ t0 + HORIZON
    @GetMapping("/prediction/historical/data")
    @ResponseBody
    public HistoricalResponse getHistoricalData(
            @RequestParam(name = "horizon") String horizon,
            @RequestParam(name = "t0") String t0
    ) {
        return predictionService.getHistoricalPrediction(horizon, t0);
    }
}
