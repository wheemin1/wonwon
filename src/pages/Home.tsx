import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 현재 월의 로그 가져오기
  const logs = useLiveQuery(
    async () => {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      return await db.logs
        .where('date')
        .between(start, end, true, true)
        .reverse()
        .sortBy('date');
    },
    [currentMonth]
  );

  // 통계 계산
  const stats = {
    paid: logs?.filter(log => log.isPaid).reduce((sum, log) => sum + log.amount, 0) || 0,
    unpaid: logs?.filter(log => !log.isPaid).reduce((sum, log) => sum + log.amount, 0) || 0,
  };

  // 결제 상태 토글
  const togglePaid = async (id: number, currentStatus: boolean) => {
    await db.logs.update(id, { isPaid: !currentStatus });
  };

  // 달력 날짜 생성
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // 달력 시작 요일 (일요일 = 0)
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  // 날짜별 로그 합계 계산
  const getDayTotal = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logs?.filter(log => log.date === dateStr) || [];
    return {
      total: dayLogs.reduce((sum, log) => sum + log.amount, 0),
      hasUnpaid: dayLogs.some(log => !log.isPaid),
      hasLogs: dayLogs.length > 0
    };
  };

  return (
    <div className="p-4 space-y-6">
      {/* 상단 통계 (고정) */}
      <div className="sticky top-0 bg-gray-50 pt-4 pb-2 z-10">
        <h1 className="text-2xl font-bold mb-4">일당노트</h1>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 받은 돈 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm text-gray-600 mb-1">받은 돈</p>
            <p className="text-2xl font-bold text-brand">
              {stats.paid.toLocaleString()}원
            </p>
          </div>

          {/* 받을 돈 (강조) */}
          <div className="bg-red-50 rounded-2xl shadow-sm p-4 border-2 border-red-200">
            <p className="text-sm text-gray-600 mb-1">받을 돈</p>
            <p className="text-2xl font-bold text-warning">
              {stats.unpaid.toLocaleString()}원
            </p>
          </div>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-4 py-2 text-gray-700 font-medium"
          >
            ← 이전
          </button>
          <h2 className="text-xl font-bold">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-4 py-2 text-gray-700 font-medium"
          >
            다음 →
          </button>
        </div>
      </div>

      {/* 달력 뷰 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-center text-sm font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="border border-gray-300" />
          ))}
          {daysInMonth.map(date => {
            const { total, hasUnpaid, hasLogs } = getDayTotal(date);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => navigate(`/add?date=${dateStr}`)}
                className={`min-h-[80px] flex flex-col items-center justify-center text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors ${
                  hasLogs ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <span className={`${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'} font-bold text-base`}>
                  {format(date, 'd')}
                </span>
                {hasLogs && (
                  <span className={`text-xs font-bold mt-1 ${hasUnpaid ? 'text-warning' : 'text-brand'}`}>
                    {(total / 10000).toFixed(0)}만
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 작업 리스트 */}
      <div className="space-y-3 pb-4">
        <h3 className="text-lg font-bold">이달의 근무</h3>
        {!logs || logs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
            아직 기록이 없습니다
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                {/* 왼쪽: 날짜 */}
                <div className="flex-shrink-0 w-20">
                  <p className="text-lg font-bold">
                    {format(new Date(log.date), 'd일')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(log.date), 'EEE', { locale: ko })}
                  </p>
                </div>

                {/* 중앙: 정보 */}
                <div className="flex-1 px-4">
                  <p className="font-medium text-gray-900">{log.location}</p>
                  <p className="text-sm text-gray-600">{log.task}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {log.amount.toLocaleString()}원
                  </p>
                </div>

                {/* 오른쪽: 결제 토글 */}
                <button
                  onClick={() => log.id && togglePaid(log.id, log.isPaid)}
                  className={`min-w-[80px] min-h-[56px] rounded-xl font-bold text-sm transition-all ${
                    log.isPaid
                      ? 'bg-brand text-white'
                      : 'bg-white border-2 border-warning text-warning'
                  }`}
                >
                  {log.isPaid ? '완료' : '미수금'}
                </button>
              </div>
              {log.memo && (
                <p className="mt-3 text-sm text-gray-600 pl-20 border-t pt-2">
                  📝 {log.memo}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
