package com.starci.waitingroom;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class WaitingRoomController {

    private final WaitingRoomService service;

    public WaitingRoomController(WaitingRoomService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/api/waitingroom/token")
    public WaitingRoomService.TokenResult token() {
        return service.enqueue();
    }

    @GetMapping("/api/waitingroom/position")
    public WaitingRoomService.PositionResult position(@RequestParam String token) {
        return service.position(token);
    }

    @PostMapping("/api/waitingroom/admit")
    @ResponseStatus(HttpStatus.OK)
    public WaitingRoomService.AdmitResult admit(@RequestBody(required = false) AdmitRequest body) {
        int count = (body == null || body.count() == null) ? 1 : Math.max(1, body.count());
        return service.admit(count);
    }

    @GetMapping("/api/waitingroom/status")
    public WaitingRoomService.StatusResult status(@RequestParam String token) {
        return service.status(token);
    }

    public record AdmitRequest(Integer count) {}
}
