package com.shravniWakde.TriagentDesk.controller;

import com.shravniWakde.TriagentDesk.io.ProfileRequest;
import com.shravniWakde.TriagentDesk.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import com.shravniWakde.TriagentDesk.io.ProfileResponse;

@RestController
@RequestMapping("/api/v1.0")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileResponse register(@RequestBody ProfileRequest profileRequest){
        ProfileResponse profileResponse = profileService.createProfile(profileRequest);

        // Send welcome email
        return profileResponse;
    }

}
