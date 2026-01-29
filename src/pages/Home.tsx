import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet';

export function Home() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPaymentMode, setIsPaymentMode] = useState(false);

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

  // 월간 요약 계산
  const monthlySummary = {
    totalDays: logs?.filter(log => !log.isDayOff).length || 0, // 휴무 제외
    totalAmount: logs?.filter(log => !log.isDayOff).reduce((sum, log) => sum + log.amount, 0) || 0,
    taxAmount: Math.floor((logs?.filter(log => !log.isDayOff).reduce((sum, log) => sum + log.amount, 0) || 0) * 0.033), // 3.3% 세금
  };

  // 결제 상태 토글
  const togglePaid = async (id: number, currentStatus: boolean) => {
    await db.logs.update(id, { isPaid: !currentStatus });
  };

  // 해당 날짜의 모든 로그 일괄 토글
  const quickToggleDate = async (dateStr: string) => {
    const dayLogs = logs?.filter(log => log.date === dateStr) || [];
    if (dayLogs.length === 0) return;
    
    // 하나라도 미수금이 있으면 모두 완료로, 모두 완료면 모두 미수금으로
    const hasUnpaid = dayLogs.some(log => !log.isPaid);
    const newStatus = hasUnpaid;
    
    for (const log of dayLogs) {
      if (log.id) {
        await db.logs.update(log.id, { isPaid: newStatus });
      }
    }
  };

  // 달력 날짜 생성
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // 달력 시작 요일 (일요일 = 0)
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  // 날짜별 로그 정보 계산
  const getDayInfo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logs?.filter(log => log.date === dateStr) || [];
    const locations = [...new Set(dayLogs.map(log => log.location))]; // 중복 제거
    return {
      total: dayLogs.reduce((sum, log) => sum + log.amount, 0),
      hasUnpaid: dayLogs.some(log => !log.isPaid),
      hasLogs: dayLogs.length > 0,
      location: locations.length === 1 ? locations[0] : locations.length > 1 ? `${locations[0]} 외${locations.length - 1}` : ''
    };
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden pb-[190px]">
      {/* 상단 통계 */}
      <div className="flex-shrink-0 bg-gray-50 pt-3 pb-2 px-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-gray-700">일당노트</h1>
          
          {/* 입금 관리 모드 스위치 */}
          <button
            onClick={() => setIsPaymentMode(!isPaymentMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              isPaymentMode 
                ? 'bg-brand text-white shadow-lg' 
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              isPaymentMode ? 'bg-white' : 'bg-gray-400'
            }`} />
            입금관리
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {/* 받은 돈 */}
          <div className="bg-white rounded-xl shadow-sm p-2 min-h-[55px] flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 mb-0.5">받은 돈</p>
            <p className="text-lg font-bold text-brand break-all">
              {stats.paid.toLocaleString()}원
            </p>
          </div>

          {/* 받을 돈 (강조) */}
          <div className="bg-red-50 rounded-xl shadow-sm p-2 border-2 border-red-200 min-h-[55px] flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 mb-0.5">받을 돈</p>
            <p className="text-lg font-bold text-warning break-all">
              {stats.unpaid.toLocaleString()}원
            </p>
          </div>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-3 py-2 text-gray-700 font-medium active:bg-gray-100 rounded-lg min-h-[44px]">
            ← 이전
          </button>
          <h2 className="text-base font-bold">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-3 py-2 text-gray-700 font-medium active:bg-gray-100 rounded-lg min-h-[44px]">
            다음 →
          </button>
        </div>
      </div>

      {/* 달력 뷰 - 화면 끝까지 채움 */}
      <div className="flex-1 bg-white mx-4 mb-4 rounded-2xl shadow-sm p-3 flex flex-col overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-0 mb-1 flex-shrink-0">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-center text-sm font-bold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 - 남은 공간 채움 */}
        <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="border border-gray-300" />
          ))}
          {daysInMonth.map(date => {
            const { total, hasUnpaid, hasLogs, location } = getDayInfo(date);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => {
                  if (hasLogs) {
                    if (isPaymentMode) {
                      // 입금 관리 모드: 즉시 토글
                      quickToggleDate(dateStr);
                    } else {
                      // 일반 모드: 상세 보기
                      setSelectedDate(dateStr);
                      setIsSheetOpen(true);
                    }
                  } else {
                    // 빈 날짜: 기록하기
                    navigate(`/add?date=${dateStr}`);
                  }
                }}
                className={`p-1 flex flex-col items-center justify-center text-sm border border-gray-300 cursor-pointer transition-colors ${
                  hasLogs ? (hasUnpaid ? 'bg-red-50' : 'bg-blue-50') : 'bg-white'
                } ${
                  isPaymentMode && hasLogs ? 'active:scale-95' : 'hover:bg-blue-50 active:bg-blue-100'
                }`}
              >
                <span className={`${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'} font-bold text-xl`}>
                  {format(date, 'd')}
                </span>
                {hasLogs && (
                  <>
                    {/* 현장명 (크게) */}
                    {location && (
                      <span className={`text-sm font-bold mt-0.5 truncate w-full text-center ${
                        location === '휴무' ? 'text-red-500' : 'text-gray-900'
                      }`}>
                        {location}
                      </span>
                    )}
                    {/* 금액 (작게) - 휴무가 아닌 경우만 */}
                    {location !== '휴무' && total > 0 && (
                      <span className={`text-[11px] mt-0.5 ${hasUnpaid ? 'text-warning' : 'text-brand'}`}>
                        {(total / 10000).toFixed(0)}만
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 바텀 시트 */}
      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        {selectedDate && (() => {
          const dayLogs = logs?.filter(log => log.date === selectedDate) || [];
          if (dayLogs.length === 0) return null;

          return (
            <div className="space-y-4">
              {/* 날짜 헤더 */}
              <div className="text-center pb-3 border-b">
                <h2 className="text-2xl font-bold">
                  {format(new Date(selectedDate), 'M월 d일 (EEE)', { locale: ko })}
                </h2>
              </div>

              {/* 로그 리스트 */}
              {dayLogs.map(log => (
                <div key={log.id} className="space-y-3">
                  {/* 현장 정보 */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-base font-medium text-gray-900 mb-1">{log.location}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {log.amount.toLocaleString()}원
                    </p>
                    {log.memo && (
                      <p className="mt-2 text-sm text-gray-600 pt-2 border-t border-gray-200">
                        📝 {log.memo}
                      </p>
                    )}
                  </div>

                  {/* 버튼 그룹 */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* 수정하기 버튼 */}
                    <button
                      onClick={() => {
                        setIsSheetOpen(false);
                        navigate(`/add?date=${selectedDate}&edit=${log.id}`);
                      }}
                      className="min-h-[64px] rounded-2xl font-bold text-lg transition-all active:scale-95 bg-gray-100 text-gray-700 border-2 border-gray-300"
                    >
                      ✏️ 수정하기
                    </button>

                    {/* 대문짝만한 입금확인 버튼 */}
                    <button
                      onClick={() => log.id && togglePaid(log.id, log.isPaid)}
                      className={`min-h-[64px] rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                        log.isPaid
                          ? 'bg-brand text-white shadow-lg'
                          : 'bg-white border-4 border-warning text-warning shadow-lg'
                      }`}
                    >
                      {log.isPaid ? '✓ 입금완료' : '입금확인'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </BottomSheet>

      {/* 하단 요약 바 (Sticky Footer) - 2분할 디자인 */}
      <div className="fixed bottom-[68px] left-0 right-0 bg-white border-t-2 border-gray-200 z-40 shadow-lg">
        {/* 세금 안내 (작게, 상단) */}
        <div className="text-center py-1.5 bg-gray-100">
          <p className="text-xs font-medium text-gray-700">
            {format(currentMonth, 'M월', { locale: ko })} 세금 3.3% 뺀 금액
          </p>
        </div>
        
        {/* 2분할: 왼쪽(근무일수) / 오른쪽(실수령액) */}
        <div className="grid grid-cols-2 divide-x-2 divide-white">
          {/* 왼쪽: 근무일수 */}
          <div className="py-3 text-center bg-gray-800">
            <p className="text-xs font-semibold text-gray-300 mb-1">근무일수</p>
            <p className="text-3xl font-extrabold text-white">
              {monthlySummary.totalDays}일
            </p>
          </div>
          
          {/* 오른쪽: 실수령 예상액 */}
          <div className="py-3 text-center bg-sky-500">
            <p className="text-xs font-semibold text-white mb-1">실수령 예상</p>
            <p className="text-3xl font-extrabold text-white">
              {(monthlySummary.totalAmount - monthlySummary.taxAmount).toLocaleString()}원
            </p>
            {stats.unpaid > 0 && (
              <p className="text-xs font-medium text-white/95 mt-1">
                미수금 {stats.unpaid.toLocaleString()}원
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
