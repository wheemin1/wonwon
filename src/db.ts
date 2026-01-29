import Dexie, { type EntityTable } from 'dexie';

// 작업 로그 인터페이스
export interface WorkLog {
  id?: number;
  date: string; // YYYY-MM-DD
  location: string;
  task: string;
  amount: number;
  isPaid: boolean;
  isDayOff?: boolean; // 휴무 여부
  memo?: string;
  createdAt: number;
}

// 설정 인터페이스
export interface Settings {
  id?: number;
  userName: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
}

// Dexie 데이터베이스 클래스
class WorkLogDB extends Dexie {
  logs!: EntityTable<WorkLog, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('workLogDB');
    
    this.version(1).stores({
      logs: '++id, date, location, isPaid, createdAt',
      settings: '++id'
    });
  }
}

export const db = new WorkLogDB();

// 초기 설정 생성 (없을 경우)
export async function initializeSettings() {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add({
      userName: '',
      bankName: '',
      bankAccount: '',
      accountHolder: ''
    });
  }
}

// 설정 가져오기
export async function getSettings(): Promise<Settings> {
  let settings = await db.settings.toCollection().first();
  if (!settings) {
    await initializeSettings();
    settings = await db.settings.toCollection().first();
  }
  return settings!;
}

// 설정 업데이트
export async function updateSettings(settings: Partial<Settings>) {
  const existing = await getSettings();
  if (existing.id) {
    await db.settings.update(existing.id, settings);
  }
}
