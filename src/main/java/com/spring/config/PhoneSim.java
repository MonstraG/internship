package com.spring.config;

import com.spring.controllers.IndexController;
import com.spring.db.Location.Location;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Random;

@Component
@EnableScheduling
@Profile("dev")
public class PhoneSim {

    @Autowired
    IndexController indexController;

    private Location oldLoc;
    private Location veryOldLoc;
    private String key;
    private String[] debugKeys = {"debug", "debug2"};
    private PhoneSim[] registeredPhoneSims = new PhoneSim[debugKeys.length];
    private boolean firstRun = true;

    PhoneSim() {
    }

    PhoneSim(IndexController indexController, String key) {

        List<Location> oldLocationsData = indexController.locationGet(key, "2");
        try {
            this.oldLoc = oldLocationsData.get(0);
            this.veryOldLoc = oldLocationsData.get(1);
        } catch (IndexOutOfBoundsException e) {
            this.oldLoc = new Location(key, 1.0, 1.0);
            this.veryOldLoc = new Location(key, 0.0, 0.0);
        }
        this.key = key;
    }

    @Scheduled(fixedRate = 5000)
    public void sendRandomLocations() {
        if (firstRun) {
            for (int i = 0; i < debugKeys.length; i++) {
                registeredPhoneSims[i] = new PhoneSim(indexController, debugKeys[i]);
            }
            firstRun = false;
        } else {
            for (PhoneSim ps : registeredPhoneSims) {
                Location newLoc = ps.getNewRandomLocation();
                indexController.locationPost(newLoc, Map.of("key", ps.key) );
                ps.shiftLocations(newLoc);
            }
        }
    }

    private void shiftLocations(Location newOldLocation) {
        veryOldLoc = oldLoc;
        oldLoc = newOldLocation;
    }

    private Location getNewRandomLocation() {
        Random rand = new Random();
        double r = rand.nextDouble() * 2; //0 .. 2
        double bearing = veryOldLoc.bearingTo(oldLoc);
        double angle = Math.toRadians(Math.toDegrees(rand.nextDouble() * 2 - 1) + bearing);
        double newLatitude = oldLoc.getLatitude() + Math.sqrt(r) * Math.cos(angle);
        if (newLatitude > 90) {
            newLatitude = 180 - newLatitude;
        }
        if (newLatitude < -90) {
            newLatitude = -newLatitude - 180;
        }
        double closerToEquatorModifier = newLatitude / 90;
        newLatitude = newLatitude - closerToEquatorModifier;
        return new Location(key,
                newLatitude,
                oldLoc.getLongitude() + Math.sqrt(r) * Math.sin(angle));
    }
}