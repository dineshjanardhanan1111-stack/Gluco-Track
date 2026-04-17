export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  diabetesType: 'Type 1' | 'Type 2' | 'Gestational' | 'Other';
  targetGlucoseMin: number;
  targetGlucoseMax: number;
  unit: 'mg/dL' | 'mmol/L';
  carbRatio?: number; // Grams of carbs covered by 1 unit of insulin
  correctionFactor?: number; // mg/dL drop per 1 unit of insulin
  basalRates?: { hour: number; rate: number }[]; // Units per hour
}

export type MealType = 'Fasting' | 'Before Breakfast' | 'After Breakfast' | 'Before Lunch' | 'After Lunch' | 'Before Dinner' | 'After Dinner' | 'Bedtime' | 'Other';
export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Other';
export type MedicationType = 'Insulin (Bolus)' | 'Insulin (Basal)' | 'Oral' | 'Other';

export interface GlucoseReading {
  id: string;
  userId: string;
  value: number;
  unit: 'mg/dL' | 'mmol/L';
  timestamp: Date;
  notes?: string;
  mealContext?: MealType;
}

export interface MealLog {
  id: string;
  userId: string;
  mealName: string;
  mealCategory?: MealCategory;
  carbs?: number;
  timestamp: Date;
  notes?: string;
  aiAnalysis?: string;
}

export interface MedicationLog {
  id: string;
  userId: string;
  medicationName: string;
  medicationType?: MedicationType;
  dose: string;
  units?: number; // Specific for insulin
  timestamp: Date;
  notes?: string;
}

export interface HealthEntry {
  type: 'glucose' | 'meal' | 'medication';
  data: GlucoseReading | MealLog | MedicationLog;
  timestamp: Date;
}
