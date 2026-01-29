import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from '../db';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Download, Copy, Check } from 'lucide-react';

interface LocationSummary {
  location: string;
  days: number;
  amount: number;
}

function groupLogsByLocation(logs: any[]): LocationSummary[] {
  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.location]) {
      acc[log.location] = { location: log.location, days: 0, amount: 0 };
    }
    acc[log.location].days += 1;
    acc[log.location].amount += log.amount;
    return acc;
  }, {} as Record<string, LocationSummary>);

  return Object.values(grouped);
}

export function Export() {
  const currentDate = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(currentDate), 'yyyy-MM-dd'));
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // 날짜 범위의 로그 가져오기
  const logs = useLiveQuery(
    async () => {
      return await db.logs
        .where('date')
        .between(startDate, endDate, true, true)
        .sortBy('date');
    },
    [startDate, endDate]
  );

  // 설정 가져오기
  const settings = useLiveQuery(() => getSettings());

  if (!logs || !settings) {
    return <div className="p-4">로딩 중...</div>;
  }

  // 현장별 요약
  const summary = groupLogsByLocation(logs);
  const totalDays = summary.reduce((sum, s) => sum + s.days, 0);
  const totalAmount = summary.reduce((sum, s) => sum + s.amount, 0);

  // 텍스트 복사
  const copyToClipboard = async () => {
    const month = format(new Date(startDate), 'M월', { locale: ko });
    const userName = settings.userName || '홍길동';

    let text = `[${month} 노임 청구서 - ${userName}]\n\n`;
    text += `■ 현장별 요약\n`;
    summary.forEach((s, i) => {
      text += `${i + 1}. ${s.location} : ${s.days}일\n`;
    });
    text += `--------------------\n`;
    text += `총 근무: ${totalDays}일\n`;
    text += `청구 금액: ${totalAmount.toLocaleString()}원\n\n`;

    text += `■ 상세 내역\n`;
    logs.forEach(log => {
      const dateStr = format(new Date(log.date), 'M/d(EEE)', { locale: ko });
      text += `${dateStr} ${log.location} : ${log.amount.toLocaleString()}\n`;
    });

    if (settings.bankName && settings.bankAccount) {
      text += `\n[입금 계좌]\n`;
      text += `${settings.bankName} ${settings.bankAccount}\n`;
      if (settings.accountHolder) {
        text += `${settings.accountHolder}\n`;
      }
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 이미지로 저장
  const saveAsImage = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `노임청구서_${format(new Date(), 'yyyy-MM-dd')}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('이미지 저장 실패:', error);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  // 달력 날짜 생성 (시각화용)
  const monthStart = startOfMonth(new Date(startDate));
  const monthEnd = endOfMonth(new Date(startDate));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  const workedDates = new Set(logs.map(log => log.date));

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">정산 내보내기</h1>

      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
          선택한 기간에 기록이 없습니다
        </div>
      ) : (
        <>
          {/* 리포트 카드 (캡처용) */}
          <div ref={reportRef} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            {/* 헤더 */}
            <div className="text-center border-b-2 pb-4">
              <h2 className="text-2xl font-bold">
                {format(new Date(startDate), 'M월', { locale: ko })} 노임 청구서
              </h2>
              {settings.userName && (
                <p className="text-lg text-gray-600 mt-1">{settings.userName}</p>
              )}
            </div>

            {/* Section A: 현장별 요약 (강조) */}
            <div className="bg-blue-50 rounded-xl p-4 border-2 border-brand">
              <h3 className="text-lg font-bold mb-3 text-brand">■ 현장별 요약</h3>
              <div className="space-y-2">
                {summary.map((s, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-blue-200 last:border-0">
                    <span className="font-medium">
                      {i + 1}. {s.location}
                    </span>
                    <span className="font-bold">
                      {s.days}일 | {s.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-brand flex justify-between items-center">
                <span className="text-xl font-bold text-brand">총 합계</span>
                <div className="text-right">
                  <p className="text-2xl font-bold text-brand">{totalDays}일</p>
                  <p className="text-2xl font-bold text-brand">{totalAmount.toLocaleString()}원</p>
                </div>
              </div>
            </div>

            {/* Section B: 달력 시각화 */}
            <div>
              <h3 className="text-lg font-bold mb-3">■ 근무 달력</h3>
              <div className="bg-gray-50 rounded-xl p-3">
                {/* 요일 */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                    <div key={day} className={`text-center text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
                      {day}
                    </div>
                  ))}
                </div>
                {/* 날짜 */}
                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {daysInMonth.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isWorked = workedDates.has(dateStr);
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`aspect-square flex items-center justify-center text-sm rounded ${
                          isWorked ? 'bg-brand text-white font-bold' : 'text-gray-400'
                        }`}
                      >
                        {format(date, 'd')}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section C: 상세 내역 */}
            <div>
              <h3 className="text-lg font-bold mb-3">■ 상세 내역</h3>
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <span className="text-gray-700">
                      {format(new Date(log.date), 'M/d(EEE)', { locale: ko })} {log.location}
                    </span>
                    <span className="font-bold">{log.amount.toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section D: 계좌 정보 */}
            {settings.bankName && settings.bankAccount && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-bold mb-2">■ 입금 계좌</h3>
                <p className="font-medium">
                  {settings.bankName} {settings.bankAccount}
                </p>
                {settings.accountHolder && (
                  <p className="text-gray-600">{settings.accountHolder}</p>
                )}
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-3 pb-4">
            {/* 메인: 텍스트 복사 (파란색, 크게) */}
            <button
              onClick={copyToClipboard}
              className="w-full min-h-[60px] bg-brand text-white text-xl font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check size={24} />
                  복사 완료!
                </>
              ) : (
                <>
                  <Copy size={24} />
                  카톡 텍스트 복사
                </>
              )}
            </button>

            {/* 서브: 이미지 저장 (회색) */}
            <button
              onClick={saveAsImage}
              className="w-full min-h-[60px] bg-gray-100 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={24} />
              이미지로 저장 (증빙용)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
