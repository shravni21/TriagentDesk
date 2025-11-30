package com.shravniWakde.TriagentDesk.service;

import com.shravniWakde.TriagentDesk.io.ProfileRequest;
import com.shravniWakde.TriagentDesk.io.ProfileResponse;

public interface ProfileService {
     ProfileResponse createProfile(ProfileRequest profileRequest);

}
