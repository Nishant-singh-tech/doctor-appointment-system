/**
 * Utility functions for Doctor Availability Slot Generation
 */

export const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const [hours, minutes] = timeStr.split(':').map((val) => parseInt(val, 10) || 0);
    return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const getDayOfWeek = (dateStr) => {
    // Parse UTC date string 'YYYY-MM-DD' cleanly
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getUTCDay()];
};

/**
 * Generates consultation slots for a doctor on a specific date based on their availability schedule
 * @param {Object} availability - Doctor's availability configuration
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Array<string>} bookedSlots - Array of timeSlot strings already booked on this date
 * @returns {Object} { dayOfWeek, isWorkingDay, slots: Array }
 */
export const generateSlotsForDate = (availability, dateStr, bookedSlots = []) => {
    if (!availability) {
        return { dayOfWeek: '', isWorkingDay: false, slots: [] };
    }

    const dayOfWeek = getDayOfWeek(dateStr);
    const workingDays = availability.workingDays || [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday'
    ];

    const isWorkingDay = workingDays.includes(dayOfWeek);
    if (!isWorkingDay) {
        return {
            dayOfWeek,
            isWorkingDay: false,
            message: `Doctor does not consult on ${dayOfWeek}s.`,
            slots: []
        };
    }

    const workStart = timeToMinutes(availability.workingHours?.start || '09:00');
    const workEnd = timeToMinutes(availability.workingHours?.end || '17:00');
    const slotDuration = parseInt(availability.slotDuration, 10) || 30;

    const hasBreak = Boolean(
        availability.breakTime?.start && availability.breakTime?.end
    );
    const breakStart = hasBreak
        ? timeToMinutes(availability.breakTime.start)
        : -1;
    const breakEnd = hasBreak
        ? timeToMinutes(availability.breakTime.end)
        : -1;

    const slots = [];
    let currentStart = workStart;

    while (currentStart + slotDuration <= workEnd) {
        const currentEnd = currentStart + slotDuration;

        // Check if slot overlaps with break time
        const overlapsBreak =
            hasBreak && currentStart < breakEnd && currentEnd > breakStart;

        if (!overlapsBreak) {
            const startStr = minutesToTime(currentStart);
            const endStr = minutesToTime(currentEnd);
            const slotString = `${startStr} - ${endStr}`;
            const isBooked = bookedSlots.includes(slotString);

            slots.push({
                timeSlot: slotString,
                startTime: startStr,
                endTime: endStr,
                isBooked
            });
        }

        currentStart = currentEnd;
    }

    return {
        dayOfWeek,
        isWorkingDay: true,
        slotDuration,
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => !s.isBooked).length,
        slots
    };
};
