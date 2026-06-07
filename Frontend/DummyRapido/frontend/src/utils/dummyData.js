/**
 * Generates dummy hourly activity data for a Rapido captain.
 * Coverage: 6:00 AM to 12:00 AM (Midnight)
 */
export const generateHourlyData = () => {
    const data = [];
    
    for (let hour = 6; hour <= 23; hour++) {
        // Randomized online status (more likely to be online during commute peaks)
        let isOnline = false;
        if (hour >= 8 && hour <= 11) isOnline = Math.random() > 0.1; // Morning Office Commute
        else if (hour >= 17 && hour <= 20) isOnline = Math.random() > 0.1; // Evening Office Commute
        else isOnline = Math.random() > 0.3; // Others
        
        // Randomized rides (more during peaks)
        let rides = 0;
        if (isOnline) {
            if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20)) {
                rides = Math.floor(Math.random() * 5) + 3; // 3-7 commute trips
            } else {
                rides = Math.floor(Math.random() * 3); // 0-2 rides
            }
        }
        
        const timeString = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
        const nextTimeString = `${(hour + 1) % 12 || 12}:00 ${(hour + 1) >= 12 ? 'PM' : 'AM'}`;

        data.push({
            timeSlot: `${timeString} - ${nextTimeString}`,
            hour: hour,
            isOnline: isOnline,
            ridesAccepted: rides,
            earnings: rides * 45 // Approx ₹45 per ride
        });
    }
    
    return data;
};

// Example usage and verification
// console.log(JSON.stringify(generateHourlyData(), null, 2));
