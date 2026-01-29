import { useState, useEffect } from 'react';
import { db, getSettings, updateSettings } from '../db';
import { Download, Upload, Trash2, Smartphone } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useToast } from '../components/Toast';

export function Settings() {
  const { showToast } = useToast();
  const [userName, setUserName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // PWA 설치 가능 이벤트 리스닝
  useEffect(() => {
    // 이미 설치되어 있는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // 설정 불러오기
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettings();
      setUserName(settings.userName);
      setBankName(settings.bankName);
      setBankAccount(settings.bankAccount);
      setAccountHolder(settings.accountHolder);
    };
    loadSettings();
  }, []);

  // 설정 저장
  const handleSave = async () => {
    await updateSettings({
      userName,
      bankName,
      bankAccount,
      accountHolder,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // 데이터 백업
  const handleBackup = async () => {
    try {
      const logs = await db.logs.toArray();
      const settings = await getSettings();

      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        logs,
        settings,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });

      saveAs(blob, `일당노트_백업_${new Date().toISOString().split('T')[0]}.json`);
      showToast('✅ 백업 파일이 저장되었습니다!', 'success');
    } catch (error) {
      console.error('백업 실패:', error);
      showToast('❌ 백업에 실패했습니다.', 'error');
    }
  };

  // 데이터 복구
  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.logs || !backup.settings) {
        throw new Error('잘못된 백업 파일입니다.');
      }

      const confirmed = confirm(
        `백업 데이터를 복구하시겠습니까?\n\n기록: ${backup.logs.length}개\n\n⚠️ 현재 데이터는 모두 삭제됩니다!`
      );

      if (!confirmed) return;

      // 기존 데이터 삭제
      await db.logs.clear();
      await db.settings.clear();

      // 백업 데이터 복구
      await db.logs.bulkAdd(backup.logs);
      if (backup.settings.id) {
        delete backup.settings.id;
      }
      await db.settings.add(backup.settings);

      showToast('✅ 데이터가 복구되었습니다!', 'success');
      window.location.reload();
    } catch (error) {
      console.error('복구 실패:', error);
      showToast('❌ 복구에 실패했습니다.', 'error');
    }
  };

  // 모든 데이터 삭제
  const handleDeleteAll = async () => {
    const confirmed = confirm(
      '⚠️ 정말로 모든 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!'
    );

    if (!confirmed) return;

    const doubleCheck = confirm(
      '한 번 더 확인합니다.\n\n모든 근무 기록과 설정이 영구적으로 삭제됩니다!'
    );

    if (!doubleCheck) return;

    try {
      await db.logs.clear();
      await db.settings.clear();
      await db.settings.add({
        userName: '',
        bankName: '',
        bankAccount: '',
        accountHolder: '',
      });

      showToast('✅ 모든 데이터가 삭제되었습니다.', 'success');
      window.location.reload();
    } catch (error) {
      console.error('삭제 실패:', error);
      showToast('❌ 삭제에 실패했습니다.', 'error');
    }
  };

  // PWA 설치
  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      showToast('이미 설치되었거나 설치할 수 없습니다.', 'info');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      showToast('✅ 앱이 설치되었습니다!', 'success');
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="p-4 space-y-6 pb-8">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* 개인 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="text-lg font-bold">개인 정보</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            성함
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="예: 홍길동"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* 계좌 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="text-lg font-bold">계좌 정보</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            은행명
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="예: 신한은행"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            계좌번호
          </label>
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="예: 110-123-456789"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            예금주
          </label>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="예: 홍길동"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-brand"
          />
        </div>

        <button
          onClick={handleSave}
          className={`w-full min-h-[56px] font-bold rounded-xl transition-all ${
            isSaved
              ? 'bg-green-500 text-white'
              : 'bg-brand text-white hover:bg-blue-600'
          }`}
        >
          {isSaved ? '✅ 저장 완료!' : '저장하기'}
        </button>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="text-lg font-bold">데이터 관리</h2>

        {/* 백업 */}
        <button
          onClick={handleBackup}
          className="w-full min-h-[56px] bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={24} />
          데이터 백업하기
        </button>

        {/* 복구 */}
        <label className="block">
          <input
            type="file"
            accept=".json"
            onChange={handleRestore}
            className="hidden"
          />
          <div className="w-full min-h-[56px] bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={24} />
            데이터 복구하기
          </div>
        </label>

        {/* 모두 삭제 */}
        <button
          onClick={handleDeleteAll}
          className="w-full min-h-[56px] bg-red-50 text-warning font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border-2 border-warning"
        >
          <Trash2 size={24} />
          모든 데이터 삭제
        </button>
      </div>

      {/* PWA 설치 */}
      {!isInstalled && deferredPrompt && (
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-lg font-bold">앱 설치</h2>
          <p className="text-sm text-gray-600 mb-3">
            홈 화면에 추가하여 앱처럼 사용하세요
          </p>
          <button
            onClick={handleInstallPWA}
            className="w-full min-h-[56px] bg-brand text-white font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Smartphone size={24} />
            홈 화면에 추가
          </button>
        </div>
      )}

      {/* 앱 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-lg font-bold mb-2">앱 정보</h2>
        <p className="text-gray-600">일당노트 v1.0</p>
        <p className="text-sm text-gray-500 mt-1">
          건설 일용직 근무 일지 및 정산 앱
        </p>
      </div>
    </div>
  );
}
