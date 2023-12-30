import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
} from "date-fns";

export const generateBabyAgeText = (dob: string) => {
  const ageInDays = differenceInCalendarDays(new Date(), new Date(dob));
  const ageInWeeks = differenceInCalendarWeeks(new Date(), new Date(dob));
  const ageInMonths = differenceInCalendarMonths(new Date(), new Date(dob));
  const ageInYears = differenceInCalendarYears(new Date(), new Date(dob));
  return ageInYears >= 2
    ? `${ageInYears} years`
    : ageInMonths >= 12
    ? `${ageInMonths} months`
    : ageInWeeks > 1
    ? `${ageInWeeks} weeks`
    : `${ageInDays} days`;
};

export const generateHourText = (value: number) => {
  if (value <= 0 || value >= 24) {
    return "12:00AM";
  }
  const isPM = value >= 12;
  let hour = value - (value % 1);
  value = value > 12 ? value - 12 : value;
  const minute = (value % 1) * 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}${isPM ? "PM" : "AM"}`;
};

export const isDuringDaytime = (
  time: Date,
  startHour: number,
  endHour: number
) => {
  const now = new Date();
  const hour = now.getHours() + Math.floor(now.getMinutes() / 60);
  return hour >= startHour && hour < endHour;
};
