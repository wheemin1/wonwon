import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { format } from 'date-fns';
import { Check } from 'lucide-react';

const TASKS = ['조적', '철거', '청소', '목공', '전기'];
const PRESET_AMOUNTS = [150000, 160000, 180000, 200000];

export function AddLog() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [location, setLocation] = useState('');
  const [task, setTask] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  const [isSticky, setIsSticky] = useState(false);

  // Sticky 로직: 마지막 로그 불러오기
  useEffect(() => {
    const loadLastLog = async () => {
      const lastLog = await db.logs
        .orderBy('createdAt')
        .reverse()
        .first();

      if (lastLog) {
        setLocation(lastLog.location);
        setTask(lastLog.task);
        setAmount(lastLog.amount);
        setIsSticky(true);
      }
    };

    loadLastLog();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!location || !task || !amount) {
      alert('현장, 작업, 금액을 모두 입력해주세요.');
      return;
    }

    await db.logs.add({
      date,
      location,
      task,
      amount: Number(amount),
      isPaid: false,
      memo,
      createdAt: Date.now(),
    });

    alert('✅ 기록이 저장되었습니다!');
    navigate('/');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">근무 기록</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* 현장 */}
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

        {/* 작업 (칩 선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            작업
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TASKS.map((taskOption) => (
              <button
                key={taskOption}
                type="button"
                onClick={() => setTask(taskOption)}
                className={`min-h-[56px] rounded-xl font-bold transition-all ${
                  task === taskOption
                    ? 'bg-brand text-white'
                    : 'bg-white border-2 border-gray-300 text-gray-700'
                }`}
              >
                {task === taskOption && <Check size={20} className="inline mr-1" />}
                {taskOption}
              </button>
            ))}
          </div>
        </div>

        {/* 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            금액
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
            placeholder="금액 입력"
            className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand mb-3"
          />
          
          {/* 프리셋 버튼 */}
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
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
