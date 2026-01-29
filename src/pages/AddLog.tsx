import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { format } from 'date-fns';
import { useToast } from '../components/Toast';

const PRESET_AMOUNTS = [130000, 150000, 180000, 200000];

export function AddLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  
  // URL에서 날짜 가져오기 (없으면 오늘)
  const dateFromUrl = searchParams.get('date');
  const editId = searchParams.get('edit'); // 수정 모드 ID
  const [date, setDate] = useState(dateFromUrl || format(new Date(), 'yyyy-MM-dd'));
  const [location, setLocation] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  const [isSticky, setIsSticky] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDayOff, setIsDayOff] = useState(false);

  // Sticky 로직: 마지막 로그 불러오기 또는 수정 모드
  useEffect(() => {
    const loadData = async () => {
      if (editId) {
        // 수정 모드: 기존 로그 불러오기
        const log = await db.logs.get(Number(editId));
        if (log) {
          setDate(log.date);
          setLocation(log.location);
          setAmount(log.amount);
          setMemo(log.memo || '');
          setIsDayOff(log.isDayOff || false);
          setIsEditMode(true);
        }
      } else {
        // 새로 추가: 마지막 로그 불러오기 (Sticky)
        const lastLog = await db.logs
          .orderBy('createdAt')
          .reverse()
          .first();

        if (lastLog) {
          setLocation(lastLog.location);
          setAmount(lastLog.amount);
          setIsSticky(true);
        }
      }
    };

    loadData();
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDayOff && !location) {
      showToast('현장을 입력해주세요.', 'error');
      return;
    }

    if (isEditMode && editId) {
      // 수정 모드
      await db.logs.update(Number(editId), {
        date,
        location: isDayOff ? '휴무' : location,
        amount: isDayOff ? 0 : (Number(amount) || 0),
        memo,
        isDayOff,
      });
      showToast('✅ 기록이 수정되었습니다!', 'success');
    } else {
      // 새로 추가
      await db.logs.add({
        date,
        location: isDayOff ? '휴무' : location,
        task: '-',
        amount: isDayOff ? 0 : (Number(amount) || 0),
        isPaid: false,
        memo,
        isDayOff,
        createdAt: Date.now(),
      });
      showToast('✅ 기록이 저장되었습니다!', 'success');
    }

    navigate('/');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">{isEditMode ? '근무 기록 수정' : '근무 기록'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 근무 / 휴무 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            근무 유형
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsDayOff(false)}
              className={`min-h-[56px] rounded-xl font-bold text-lg transition-all ${
                !isDayOff
                  ? 'bg-brand text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              💼 근무
            </button>
            <button
              type="button"
              onClick={() => setIsDayOff(true)}
              className={`min-h-[56px] rounded-xl font-bold text-lg transition-all ${
                isDayOff
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              🛌 휴무
            </button>
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            날짜
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>

        {/* 현장 (근무일 때만) */}
        {!isDayOff && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현장 {isSticky && <span className="text-xs text-brand ml-2">📌 최근</span>}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 당진 공장"
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
            />
          </div>
        )}

        {/* 금액 (근무일 때만, 선택) */}
        {!isDayOff && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              금액 (선택)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value ? Number(e.target.value) : '');
              }}
              placeholder="직접 입력 또는 아래 버튼 선택"
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand mb-3"
            />
            
            {/* 프리셋 버튼 */}
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                  }}
                  className={`min-h-[56px] rounded-xl font-bold transition-all ${
                    amount === preset
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {(preset / 10000).toFixed(0)}만
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메모 (선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메모 (선택)
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="추가 메모 사항"
            rows={3}
            className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="w-full min-h-[60px] bg-brand text-white text-xl font-bold rounded-xl hover:bg-blue-600 transition-colors"
        >
          기록하기
        </button>
      </form>
    </div>
  );
}
