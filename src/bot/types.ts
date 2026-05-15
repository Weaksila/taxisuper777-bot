export type Lang = "uz" | "ru";

export interface VerificationResult {
  passed: boolean;
  checks: { label: string; ok: boolean; note?: string }[];
  score: number;
}

export interface Trip {
  orderId: string;
  route: string;
  date: string;
  passengerName: string;
  rating?: number;
  comment?: string;
  price: number;
}

export interface WeeklySchedule {
  mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean;
  startTime: string;
  endTime: string;
}

export interface EarningsEntry {
  date: string;
  amount: number;
  route: string;
  passengerName: string;
  orderId: string;
}

export interface SavedAddress {
  name: string;
  address: string;
  type: "home" | "work" | "other";
}

export interface PassengerPrefs {
  luggage?: boolean;
  kids?: boolean;
  pets?: boolean;
  smoking?: boolean;
  notes?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface DriverAnalytics {
  routeCounts: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  dailyEarnings: Record<string, number>;
  categoryRatings: {
    punctuality: number[];
    cleanliness: number[];
    driving: number[];
    behavior: number[];
  };
}

export interface Driver {
  chatId: number;
  name: string;
  phone: string;
  carNumber: string;
  carModel: string;
  route: string;
  seats: number;
  departureTime: string;
  price: number;
  approved: boolean;
  blocked: boolean;
  online: boolean;
  lastSeen?: Date;
  verification?: VerificationResult;
  totalRating: number;
  ratingCount: number;
  trips: Trip[];
  schedule?: WeeklySchedule;
  earnings: EarningsEntry[];
  analytics: DriverAnalytics;
  breakUntil?: Date;
  dailyOrders: number;
  lastOrderDate: string;
}

export interface Passenger {
  chatId: number;
  name: string;
  phone: string;
  route: string;
  seats: number;
  departureTime: string;
  location?: { latitude: number; longitude: number };
  favorites: number[];
  savedAddresses: SavedAddress[];
  emergencyContact?: EmergencyContact;
  prefs?: PassengerPrefs;
}

export interface LastOrder {
  route: string;
  seats: number;
  name: string;
  phone: string;
}

export interface Order {
  id: string;
  passenger: Passenger;
  driverId: number | null;
  status: "pending" | "accepted" | "completed" | "rejected" | "expired";
  createdAt: Date;
  rated: boolean;
  type: "passenger" | "parcel";
  parcelDesc?: string;
  scheduledDate?: string;
  prefs?: PassengerPrefs;
  retryCount: number;
  expiresAt: Date;
  isBookedForOther?: boolean;
  actualPassengerName?: string;
  actualPassengerPhone?: string;
}

export interface Complaint {
  id: string;
  from: number;
  fromName: string;
  route: string;
  text: string;
  createdAt: Date;
  resolved: boolean;
}

export interface SosAlert {
  id: string;
  from: number;
  fromName: string;
  phone: string;
  orderId?: string;
  driverName?: string;
  driverPhone?: string;
  carNumber?: string;
  route?: string;
  createdAt: Date;
}

export interface BlacklistEntry {
  chatId: number;
  name: string;
  phone: string;
  reason: string;
  addedAt: Date;
}

export interface ScheduledBroadcast {
  id: string;
  message: string;
  scheduledAt: Date;
  sent: boolean;
}

export interface UserState {
  step: string;
  data: Record<string, any>;
}
