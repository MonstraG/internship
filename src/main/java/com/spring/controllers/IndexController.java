package com.spring.controllers;

import com.spring.db.Key.Key;
import com.spring.db.Key.KeyDAO;
import com.spring.db.Location.Location;
import com.spring.db.Location.LocationDAO;
import com.spring.db.User.User;
import com.spring.db.User.UserDAO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.ModelAndView;

import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/*")
public class IndexController {

    @Autowired
    LocationDAO locationDAO;
    @Autowired
    KeyDAO keyDAO;
    @Autowired
    UserDAO userDAO;
    @Autowired
    SimpMessagingTemplate template;
    @Autowired
    PasswordEncoder passwordEncoder;

    @RequestMapping(value = "/location", method = RequestMethod.POST, consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity locationPost(@RequestBody Location payload, @RequestHeader Map<String, String> header) {
        Location location;
        String key = header.get("key");
        try {
            location = new Location(key, payload.getLatitude(), payload.getLongitude()); //adds timestamp.
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Could not find latitude or longitude data.");
        }

        //getting last location from table
        Location oldLocation;
        try {
            oldLocation = locationDAO.getLastLocation(location.getKey());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Following exception was thrown when trying to get last item from table:\n" + e.toString());
        }

        if ((oldLocation != null) && location.needToMigrate(oldLocation)) {
            //updating last location
            Location updatedLocation = oldLocation.getAverageLocation(location);
            try {
                locationDAO.updateLocation(updatedLocation);
            } catch (Exception e) {
                e.printStackTrace();
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body("Following exception was thrown when trying to update table item:\n" + e.toString());
            }
        } else {
            //inserting new location into the table
            try {
                locationDAO.createLocation(location);
                updateEveryone(location);
            } catch (Exception e) {
                e.printStackTrace();
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body("Following exception was thrown when trying to add item to the table:\n" + e.toString());
            }
        }
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @RequestMapping(value = "/location/{key}", method = RequestMethod.GET)
    @ResponseBody
    public List<Location> locationGet(@PathVariable String key) {
        return locationDAO.getAllLocationsByKey(key);
    }

    @RequestMapping(value = "/location/{key}/{number}", method = RequestMethod.GET)
    @ResponseBody
    public List<Location> locationGet(@PathVariable String key, @PathVariable String number) {
        return locationDAO.getLastNofLocations(key, Long.getLong(number));
    }

    @RequestMapping(value = "/location", method = RequestMethod.GET)
    @ResponseBody
    public List<Location> locationGet() {
        return locationDAO.getAllLocations();
    }

    @RequestMapping(value = "/install", method = RequestMethod.POST)
    @ResponseBody
    public ResponseEntity installKey(@RequestBody Key key) {
        if (key.getUsername() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Username was not provided.");
        }

        if (key.getKey() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Key was not provided.");
        }

        try {
            if (userDAO.userExists(key.getUsername())) {
                keyDAO.createKey(key);
            } else
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Provided user does not exist.");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Following exception was thrown when trying to add item to the table:\n" + e.toString());
        }

        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @RequestMapping(value = "/register", method = RequestMethod.POST, produces = "text/plain")
    @ResponseBody
    public ResponseEntity registerUser(@RequestBody User user) {
        try {
            if (!userDAO.userExists(user.getUsername())) {
                user.setPassword(passwordEncoder.encode(user.getPassword()));
                userDAO.createUser(user);
            } else
                return ResponseEntity.status(HttpStatus.OK).body("User already exists.");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Following exception was thrown when trying to add item to the table:\n" + e.toString());
        }
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @RequestMapping(value = "/ui", method = RequestMethod.GET)
    public ModelAndView uiIndexGet() {
        return new ModelAndView("templates/index");
    }

    @RequestMapping(value = "/login")
    public ModelAndView login() {
        return new ModelAndView("templates/login");
    }

    @RequestMapping(value = "/keys/{username}", method = RequestMethod.GET)
    @ResponseBody
    public List<Key> keysGet(@PathVariable String username) {
        return keyDAO.getAllKeysByUsername(username);
    }

    @RequestMapping(value = "/userdata", method = RequestMethod.GET)
    @ResponseBody
    public User settingsGets(Authentication authentication) {
        User user = userDAO.getUserByUsername(authentication.getName());
        user.setPassword("");
        return user;
    }

    private void updateEveryone(Location location) {
        this.template.convertAndSend("/location-updates-any/", location.getKey());
        this.template.convertAndSend("/location-updates/" + location.getKey(), location.toJSON());
    }
}



