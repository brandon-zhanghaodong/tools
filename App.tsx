import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserRole, 
  User, 
  ReviewCycle, 
  ReviewAssignment, 
  Relationship, 
  EvaluationStatus,
  Question,
  Organization
} from './types';
import { Card, Button, Badge, InstructionAlert } from './components/UIComponents';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { generateFeedbackSummary, generateReviewRelationships, generateQuestionnaire, parseOrgChartToRelationships, parseUserList } from './services/geminiService';

// --- Helper Functions ---
const generateRandomPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; 
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

const generateRecoveryKey = () => {
  return Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
};

// --- Mock Data (SaaS Structure) ---
const MOCK_ORGS: Organization[] = [
  { id: 'org1', name: 'Nexus Tech Inc.', code: 'nexus', recoveryKey: 'NEXU-SREC-OVER-KEY1', createdAt: '2024-01-01' },
  { id: 'org2', name: 'Future Retail Ltd.', code: 'future', recoveryKey: 'FUTU-RE77-KEY9-9999', createdAt: '2024-02-15' }
];

const MOCK_USERS: User[] = [
  // Org 1 Users (Nexus)
  { id: 'u1', organizationId: 'org1', name: '系统管理员', username: 'admin', password: '123', email: 'admin@nexus.com', role: UserRole.ADMIN, department: 'HR', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin' },
  { id: 'u2', organizationId: 'org1', name: '研发总监', username: 'director', password: '123', email: 'director@nexus.com', role: UserRole.MANAGER, department: 'Tech', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Manager' },
  { id: 'u3', organizationId: 'org1', name: '高级工程师 A', username: 'engineer_a', password: '123', email: 'eng.a@nexus.com', role: UserRole.EMPLOYEE, department: 'Tech', managerId: 'u2', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=EngA' },
  { id: 'u4', organizationId: 'org1', name: 'UI/UX 设计师', username: 'designer', password: '123', email: 'design@nexus.com', role: UserRole.EMPLOYEE, department: 'Design', managerId: 'u2', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Designer' },
  
  // Org 2 Users (Future Retail) - Login with same username 'admin' but different org code
  { id: 'u101', organizationId: 'org2', name: 'HR Admin', username: 'admin', password: '123', email: 'hr@future.com', role: UserRole.ADMIN, department: 'HR', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HRFuture' },
];

const INITIAL_QUESTIONS: Question[] = [
  { id: 'q1', text: '公正对待团队成员', category: '诚信正直' },
  { id: 'q2', text: '巨大压力或诱惑下坚持原则', category: '诚信正直' },
  { id: 'q3', text: '主动寻求他人对自己的反馈/评价', category: '学习创新' },
  { id: 'q4', text: '借鉴标杆，尝试创新', category: '学习创新' },
  { id: 'q5', text: '清晰传达公司战略目标', category: '战略思维' },
  { id: 'q6', text: '提出改进组织流程的建议', category: '组织优化' },
  { id: 'q7', text: '识别他人的优势或不足', category: '人才开发' },
];

const INITIAL_CYCLES: ReviewCycle[] = [
  { id: 'c1', organizationId: 'org1', name: '2025年Q1 绩效评估', status: 'ACTIVE', dueDate: '2025-03-31' },
  { id: 'c2', organizationId: 'org2', name: '2024年度总结', status: 'ACTIVE', dueDate: '2024-12-31' },
];

const INITIAL_ASSIGNMENTS: ReviewAssignment[] = [
  {
    id: 'a1', organizationId: 'org1', cycleId: 'c1', reviewerId: 'u3', subjectId: 'u3', relationship: Relationship.SELF, status: EvaluationStatus.PENDING, scores: {}, comments: {}, feedbackStrengths: '', feedbackImprovements: ''
  },
  {
    id: 'a2', organizationId: 'org1', cycleId: 'c1', reviewerId: 'u2', subjectId: 'u3', relationship: Relationship.MANAGER, status: EvaluationStatus.SUBMITTED, 
    scores: { q1: 4, q2: 5, q3: 3, q4: 4, q5: 3, q6: 4, q7: 4 }, 
    comments: {}, 
    feedbackStrengths: "事业激情高，团队合作意识强。",
    feedbackImprovements: "执行力需要加强，战略思维有待提升。"
  }
];

// --- Icons ---
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  Chart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Lock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Key: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-3m10 3v-3m-10 3h10" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  ShieldCheck: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
};

// --- Reused Components ---
// (Keeping Card, InstructionAlert, Button, Badge, ConfirmDialog, ChangePasswordModal, NavButton as is)
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100 border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
          <span className="bg-red-100 text-red-600 p-1 rounded-full mr-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </span>
          {title}
        </h3>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed ml-8">{message}</p>
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          <Button variant="danger" onClick={onConfirm}>确认执行</Button>
        </div>
      </div>
    </div>
  );
};

const ChangePasswordModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (o: string, n: string) => void }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <span className="bg-blue-100 text-blue-600 p-1.5 rounded-full mr-2"><Icons.Key /></span>
          修改密码
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">当前密码</label>
            <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={oldPass} onChange={e => setOldPass(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">新密码</label>
            <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={newPass} onChange={e => setNewPass(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">确认新密码</label>
            <input type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => {
             if(newPass !== confirmPass) { alert("新密码与确认密码不一致"); return; }
             if(!newPass) { alert("新密码不能为空"); return; }
             onSave(oldPass, newPass);
             setOldPass(''); setNewPass(''); setConfirmPass('');
          }}>确认修改</Button>
        </div>
      </div>
    </div>
  )
}

const NavButton = ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children?: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <span className={`flex-shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`}>{icon}</span>
    <span className="ml-3 flex-1 text-left flex items-center">{children}</span>
  </button>
);

// --- Login Screen (SaaS Version) ---
const LoginScreen = ({ 
  onLogin, 
  onRegister, 
  onRecover,
  error 
}: { 
  onLogin: (orgCode: string, u: string, p: string) => void, 
  onRegister: (orgName: string, orgCode: string, adminName: string, adminUser: string, adminPass: string) => void,
  onRecover: (orgCode: string, recoveryKey: string, newPass: string) => void,
  error: string | null 
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [showRecovery, setShowRecovery] = useState(false);
  const [orgCode, setOrgCode] = useState(''); // nexus
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register Fields
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Recovery Fields
  const [recoverOrgCode, setRecoverOrgCode] = useState('');
  const [recoverKey, setRecoverKey] = useState('');
  const [recoverNewPass, setRecoverNewPass] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'LOGIN') {
      onLogin(orgCode, username, password);
    } else {
      if(!newOrgName || !newOrgCode || !newAdminName || !newAdminUsername || !newAdminPassword) {
        alert("请填写所有字段");
        return;
      }
      onRegister(newOrgName, newOrgCode, newAdminName, newAdminUsername, newAdminPassword);
    }
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewOrgName(name);
    // Auto-generate code if user hasn't manually edited it much (simple heuristic or just overwrite)
    // Here we just suggest one if empty or matches previous suggestion
    if (!newOrgCode || newOrgCode === name.slice(0, 6).toLowerCase().replace(/\s+/g, '')) {
       setNewOrgCode(name.toLowerCase().replace(/\s+/g, '').slice(0, 6));
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRecover(recoverOrgCode, recoverKey, recoverNewPass);
    setShowRecovery(false);
    setRecoverOrgCode(''); setRecoverKey(''); setRecoverNewPass('');
  };

  const handleResetData = () => {
    if(confirm("确定要重置所有演示数据吗？这将清除所有注册的企业和用户，恢复到初始演示状态。")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (showRecovery) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100">
          <div className="flex items-center mb-6">
             <div className="bg-yellow-100 p-2 rounded-full mr-3"><Icons.ShieldCheck /></div>
             <div>
               <h3 className="text-lg font-bold text-slate-900">管理员账号恢复</h3>
               <p className="text-xs text-slate-500">使用注册时提供的恢复密钥重置管理员密码。</p>
             </div>
          </div>
          
          <form className="space-y-4" onSubmit={handleRecoverySubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">企业代码 (Org Code)</label>
              <input required type="text" className="w-full p-2 border border-slate-300 rounded text-sm" value={recoverOrgCode} onChange={e => setRecoverOrgCode(e.target.value)} placeholder="例如: nexus" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">恢复密钥 (Recovery Key)</label>
              <input required type="text" className="w-full p-2 border border-slate-300 rounded text-sm font-mono" value={recoverKey} onChange={e => setRecoverKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">设置新管理员密码</label>
              <input required type="password" className="w-full p-2 border border-slate-300 rounded text-sm" value={recoverNewPass} onChange={e => setRecoverNewPass(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 mt-6 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowRecovery(false)}>返回登录</Button>
              <Button type="submit">确认重置</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-xl mb-4">
          <span className="font-bold text-2xl text-white">N</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">Nexus360 测评系统</h2>
        <p className="mt-2 text-center text-sm text-slate-600">企业级多租户绩效评估平台</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
          <div className="flex border-b border-slate-200 mb-6">
            <button 
              className={`flex-1 pb-2 text-sm font-bold ${mode === 'LOGIN' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
              onClick={() => setMode('LOGIN')}
            >
              员工/管理员登录
            </button>
            <button 
              className={`flex-1 pb-2 text-sm font-bold ${mode === 'REGISTER' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
              onClick={() => setMode('REGISTER')}
            >
              注册新企业
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}
            
            {mode === 'LOGIN' ? (
              <>
                 <div>
                  <label className="block text-sm font-medium text-slate-700">企业代码 (Company ID) 或 名称</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Icons.Building />
                    </div>
                    <input
                      type="text"
                      required
                      value={orgCode}
                      onChange={(e) => setOrgCode(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md p-2 border"
                      placeholder="例如: nexus 或 Nexus Tech"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">用户名</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="请输入您的账号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">密码</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex justify-end">
                   <button type="button" onClick={() => setShowRecovery(true)} className="text-xs text-blue-600 hover:text-blue-800">忘记密码 / 恢复账号?</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700">企业名称</label>
                    <input
                      type="text"
                      required
                      value={newOrgName}
                      onChange={handleOrgNameChange}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="例如: My Tech Startup"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700">
                      企业代码 (登录ID) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                       <input
                        type="text"
                        required
                        value={newOrgCode}
                        onChange={(e) => setNewOrgCode(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border font-mono bg-slate-50"
                        placeholder="例如: mytech"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">员工将使用此代码进行登录，请牢记。</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">管理员信息</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">姓名</label>
                      <input
                        type="text"
                        required
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">登录账号 (Username)</label>
                      <input
                        type="text"
                        required
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">设置密码</label>
                      <input
                        type="password"
                        required
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {mode === 'LOGIN' ? '安全登录' : '立即注册并试用'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
             <div className="flex items-center space-x-2">
                <Icons.Lock /> <span>企业级数据隔离加密存储</span>
             </div>
             <button onClick={handleResetData} className="text-slate-300 hover:text-red-400 underline">
               重置演示数据
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Missing Components Definitions ---

const Dashboard = ({ user, users, assignments, setTab }: { user: User, users: User[], assignments: ReviewAssignment[], setTab: (t: any) => void }) => {
  const myTodo = assignments.filter(a => a.reviewerId === user.id && a.status !== EvaluationStatus.SUBMITTED);
  const myDone = assignments.filter(a => a.reviewerId === user.id && a.status === EvaluationStatus.SUBMITTED);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-slate-500">待处理评估</h3>
          <div className="mt-2 flex items-baseline">
             <span className="text-3xl font-bold text-slate-900">{myTodo.length}</span>
             <span className="ml-2 text-sm text-slate-500">个任务</span>
          </div>
          <Button variant="ghost" className="mt-4 text-sm p-0 text-blue-600 hover:text-blue-800" onClick={() => setTab('my-reviews')}>立即处理 &rarr;</Button>
        </Card>
        <Card className="p-6 border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-slate-500">已完成评估</h3>
          <div className="mt-2 flex items-baseline">
             <span className="text-3xl font-bold text-slate-900">{myDone.length}</span>
             <span className="ml-2 text-sm text-slate-500">个任务</span>
          </div>
        </Card>
        <Card className="p-6 border-l-4 border-purple-500">
          <h3 className="text-sm font-medium text-slate-500">团队人数</h3>
          <div className="mt-2 flex items-baseline">
             <span className="text-3xl font-bold text-slate-900">{users.length}</span>
             <span className="ml-2 text-sm text-slate-500">人</span>
          </div>
        </Card>
      </div>
      
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
        <h3 className="font-bold text-blue-900 mb-2">欢迎回来, {user.name}</h3>
        <p className="text-blue-700 text-sm">
          当前绩效考核周期正在进行中。请确保在截止日期前完成所有指派给您的评估任务。
          作为{user.role === 'MANAGER' ? '管理者' : '员工'}，您的反馈对团队成长至关重要。
        </p>
      </div>
    </div>
  );
};

const MyReviewsList = ({ user, users, assignments, questions, onSubmit }: { user: User, users: User[], assignments: ReviewAssignment[], questions: Question[], onSubmit: any }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");

  const myAssignments = assignments.filter(a => a.reviewerId === user.id);
  const activeAssignment = myAssignments.find(a => a.id === editingId);
  const subject = activeAssignment ? users.find(u => u.id === activeAssignment.subjectId) : null;

  const handleStart = (a: ReviewAssignment) => {
     setScores(a.scores || {});
     setComments(a.comments || {});
     setStrengths(a.feedbackStrengths || "");
     setImprovements(a.feedbackImprovements || "");
     setEditingId(a.id);
  };

  const handleSubmit = () => {
    if (!editingId) return;
    if (Object.keys(scores).length < questions.length) {
       alert("请为所有维度打分");
       return;
    }
    onSubmit(editingId, scores, comments, strengths, improvements);
    setEditingId(null);
  };

  if (editingId && activeAssignment && subject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-bold text-slate-800">正在评估: {subject.name} <span className="text-sm font-normal text-slate-500">({activeAssignment.relationship})</span></h2>
           <Button variant="secondary" onClick={() => setEditingId(null)}>返回列表</Button>
        </div>
        
        <Card className="p-6 space-y-8">
           {questions.map(q => (
             <div key={q.id} className="border-b border-slate-100 pb-6 last:border-0">
                <div className="mb-2">
                   <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{q.category}</span>
                   <p className="mt-2 text-slate-800 font-medium">{q.text}</p>
                </div>
                <div className="flex items-center gap-4 mt-3">
                   <div className="flex gap-2">
                      {[1,2,3,4,5].map(s => (
                        <button 
                          key={s}
                          onClick={() => setScores({...scores, [q.id]: s})}
                          className={`w-10 h-10 rounded-full font-bold transition-all ${scores[q.id] === s ? 'bg-blue-600 text-white scale-110' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {s}
                        </button>
                      ))}
                   </div>
                   <input 
                     placeholder="添加评论 (可选)" 
                     className="flex-1 text-sm border-slate-200 rounded-md p-2" 
                     value={comments[q.id] || ''}
                     onChange={e => setComments({...comments, [q.id]: e.target.value})}
                   />
                </div>
             </div>
           ))}
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">主要优势 (Strengths)</label>
                 <textarea 
                    className="w-full border-slate-300 rounded-lg p-3 text-sm h-32"
                    placeholder="该员工在哪些方面表现出色？"
                    value={strengths}
                    onChange={e => setStrengths(e.target.value)}
                 />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">改进建议 (Improvements)</label>
                 <textarea 
                    className="w-full border-slate-300 rounded-lg p-3 text-sm h-32"
                    placeholder="该员工在哪些方面需要改进？"
                    value={improvements}
                    onChange={e => setImprovements(e.target.value)}
                 />
              </div>
           </div>

           <div className="pt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
              <Button onClick={handleSubmit}>提交评估</Button>
           </div>
        </Card>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">被评估人</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">关系</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">状态</th>
            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
           {myAssignments.length === 0 && (
             <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">暂无评估任务</td></tr>
           )}
           {myAssignments.map(a => {
             const subj = users.find(u => u.id === a.subjectId);
             return (
               <tr key={a.id}>
                 <td className="px-6 py-4 text-sm font-medium text-slate-900">{subj?.name || 'Unknown'}</td>
                 <td className="px-6 py-4 text-sm text-slate-500"><Badge>{a.relationship}</Badge></td>
                 <td className="px-6 py-4 text-sm">
                    {a.status === 'SUBMITTED' 
                      ? <span className="text-green-600 font-bold text-xs flex items-center"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>已提交</span>
                      : <span className="text-orange-500 font-bold text-xs">待处理</span>
                    }
                 </td>
                 <td className="px-6 py-4 text-right">
                    {a.status !== 'SUBMITTED' && (
                       <Button className="px-3 py-1 text-xs" onClick={() => handleStart(a)}>开始评估</Button>
                    )}
                 </td>
               </tr>
             )
           })}
        </tbody>
      </table>
    </Card>
  )
};

const TeamReports = ({ user, users, assignments, questions, sharedReports, onToggleShare }: any) => {
  const relevantUsers = user.role === UserRole.ADMIN 
     ? users 
     : users.filter((u: User) => u.managerId === user.id || u.id === user.id);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const handleGenerateSummary = async (subject: User) => {
    setLoadingSummary(true);
    const subjectReviews = assignments.filter((a: ReviewAssignment) => a.subjectId === subject.id && a.status === EvaluationStatus.SUBMITTED);
    const res = await generateFeedbackSummary(subjectReviews, questions, subject.name);
    setSummary(res);
    setLoadingSummary(false);
  };

  const selectedUser = users.find((u: User) => u.id === selectedUserId);

  if (selectedUserId && selectedUser) {
    const subjectReviews = assignments.filter((a: ReviewAssignment) => a.subjectId === selectedUserId && a.status === EvaluationStatus.SUBMITTED);
    
    // Better Radar Data: Group by Category
    const categoryMap = new Map<string, { total: number, count: number }>();
    subjectReviews.forEach((r: ReviewAssignment) => {
       Object.entries(r.scores).forEach(([qId, score]) => {
          const q = questions.find((qu: Question) => qu.id === qId);
          if (q && typeof score === 'number') {
             const curr = categoryMap.get(q.category) || { total: 0, count: 0 };
             categoryMap.set(q.category, { total: curr.total + score, count: curr.count + 1 });
          }
       });
    });

    const chartData = Array.from(categoryMap.entries()).map(([cat, val]) => ({
       subject: cat,
       A: (val.total / val.count).toFixed(1),
       fullMark: 5
    }));

    return (
       <div className="space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold text-slate-800">绩效报告: {selectedUser.name}</h2>
             <Button variant="secondary" onClick={() => { setSelectedUserId(null); setSummary(null); }}>返回列表</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6">
                <h3 className="font-bold text-slate-700 mb-4">能力雷达图</h3>
                <div className="h-64 flex items-center justify-center">
                   {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} />
                          <Radar name={selectedUser.name} dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                   ) : (
                      <p className="text-slate-400 text-sm">暂无足够数据生成图表</p>
                   )}
                </div>
             </Card>

             <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="font-bold text-slate-700">AI 智能分析</h3>
                   <Button className="text-xs" onClick={() => handleGenerateSummary(selectedUser)} isLoading={loadingSummary} disabled={subjectReviews.length === 0}>
                     {summary ? '重新生成' : '生成分析'}
                   </Button>
                </div>
                {summary ? (
                   <div className="space-y-4 animate-in fade-in">
                      <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 leading-relaxed">
                         {summary.summary}
                      </div>
                      <div>
                         <span className="text-xs font-bold text-green-600 uppercase">优势</span>
                         <div className="flex flex-wrap gap-2 mt-1">
                            {summary.strengths.map((s:string, i:number) => <Badge key={i} color="green">{s}</Badge>)}
                         </div>
                      </div>
                      <div>
                         <span className="text-xs font-bold text-orange-600 uppercase">建议改进</span>
                         <div className="flex flex-wrap gap-2 mt-1">
                            {summary.improvements.map((s:string, i:number) => <Badge key={i} color="yellow">{s}</Badge>)}
                         </div>
                      </div>
                   </div>
                ) : (
                   <p className="text-slate-400 text-sm">点击生成按钮获取基于 {subjectReviews.length} 份评估的 AI 洞察。</p>
                )}
             </Card>
          </div>
       </div>
    )
  }

  return (
     <Card>
        <div className="p-4 border-b border-slate-100">
           <h3 className="font-bold text-slate-800">团队成员</h3>
        </div>
        <ul className="divide-y divide-slate-100">
           {relevantUsers.map((u: User) => (
              <li key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                 <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 mr-3">
                       {u.name.charAt(0)}
                    </div>
                    <div>
                       <p className="text-sm font-medium text-slate-900">{u.name}</p>
                       <p className="text-xs text-slate-500">{u.department}</p>
                    </div>
                 </div>
                 <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </li>
           ))}
        </ul>
     </Card>
  )
};

// --- Modified Admin Console ---

const AdminConsole = ({ 
  users, 
  setUsers,
  questions, 
  setQuestions,
  assignments, 
  setAssignments,
  cycle,
  setCycle,
  currentUser,
  orgId
}: { 
  users: User[], 
  setUsers: (users: User[]) => void,
  questions: Question[], 
  setQuestions: (q: Question[]) => void,
  assignments: ReviewAssignment[],
  setAssignments: (a: ReviewAssignment[]) => void,
  cycle: ReviewCycle,
  setCycle: (c: ReviewCycle) => void,
  currentUser: User,
  orgId: string
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'relations' | 'questions'>('users');
  const [generatingRel, setGeneratingRel] = useState(false);
  const [generatingQ, setGeneratingQ] = useState(false);
  const [importText, setImportText] = useState('');
  const [importingOrg, setImportingOrg] = useState(false);
  const [importingUsers, setImportingUsers] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  // User Management State
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456', managerId: '' });

  // Relationship Filtering
  const [filterUserId, setFilterUserId] = useState<string>('');

  const handleExportUsers = () => {
    // UTF-8 BOM for Excel to open Chinese characters correctly
    const BOM = "\uFEFF"; 
    const headers = ["ID", "姓名", "用户名", "邮箱", "角色", "部门", "直属经理ID"];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.username,
      u.email,
      u.role,
      u.department,
      u.managerId || ''
    ]);

    const csvContent = BOM + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexus360_users_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchGeneratePasswords = () => {
    setConfirmConfig({
      isOpen: true,
      title: '批量生成随机密码',
      message: '确定要为当前企业所有用户（除您自己外）重新生成随机的 8 位密码吗？',
      onConfirm: () => {
        const updated = users.map(u => {
          if (u.id === currentUser.id) return u; 
          return { ...u, password: generateRandomPassword() };
        });
        setUsers(updated);
        setConfirmConfig(null);
        alert("已成功为员工生成新的随机密码！");
      }
    });
  };

  const handleExportCredentials = () => {
    const BOM = "\uFEFF"; 
    const headers = ["姓名", "登录账号 (Username)", "登录密码 (Password)", "角色", "部门"];
    const rows = users.map(u => [
      u.name,
      u.username,
      u.password || '123456',
      u.role === UserRole.ADMIN ? '管理员' : u.role === UserRole.MANAGER ? '经理' : '员工',
      u.department
    ]);

    const csvContent = BOM + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexus360_credentials_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateRelationships = async () => {
    setGeneratingRel(true);
    const newRels = await generateReviewRelationships(users, cycle.id, orgId);
    setAssignments(newRels);
    setGeneratingRel(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteAssignment = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '移除考核关系',
      message: '确定要移除这条考核关系吗？',
      onConfirm: () => {
        setAssignments(assignments.filter(a => a.id !== id));
        setConfirmConfig(null);
      }
    });
  };

  const handleAddQuestion = () => {
    const newId = `q-custom-${Date.now()}`;
    setQuestions([...questions, {
      id: newId,
      organizationId: orgId,
      category: '自定义维度',
      text: '请在此输入新的考核题目...'
    }]);
  };

  const updateQuestion = (id: string, field: 'category' | 'text', value: string) => {
    const updated = questions.map(q => q.id === id ? { ...q, [field]: value } : q);
    setQuestions(updated);
  };

  const deleteQuestion = (id: string) => {
     setQuestions(questions.filter(q => q.id !== id));
  };

  const handleImportOrgChart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fileInput = document.getElementById('orgChartFile') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!importText.trim() && !file) {
      alert("请上传文件或输入文本描述以开始导入。");
      return;
    }
    setImportingOrg(true);
    
    let filePart = undefined;
    let textInstruction = importText;

    if (file) {
      if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
         const text = await file.text();
         textInstruction += `\n\n[Attached File Content]:\n${text}`;
      } else {
         const base64Data = await fileToBase64(file);
         let mimeType = file.type;
         if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'application/pdf'; // fallback
         filePart = { mimeType, data: base64Data };
      }
    }

    const result = await parseOrgChartToRelationships(textInstruction, users, cycle.id, orgId, filePart);
    
    if (result.newUsers && result.newUsers.length > 0) {
      const createdUsers = (result.newUsers || []).map(u => ({
        id: u.id || `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organizationId: orgId,
        name: u.name || 'New User',
        username: (u.name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        password: '123456',
        email: u.email || 'user@example.com',
        role: (u.role ? u.role.toUpperCase() as UserRole : UserRole.EMPLOYEE),
        department: u.department || 'Imported',
        managerId: u.managerId,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`
      }));
      setUsers([...users, ...createdUsers]);
    }

    if (result.assignments && result.assignments.length > 0) {
      setAssignments([...assignments, ...result.assignments]);
      alert(`导入成功！添加了 ${result.newUsers.length} 位用户和 ${result.assignments.length} 条考核关系。`);
    } else {
      alert("AI未能识别出有效数据，请重试。");
    }
    
    setImportingOrg(false);
  };

  const handleImportUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingUsers(true);
    try {
      let filePart = null;
      let textContent = '';
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
         textContent = await file.text();
      } else {
         const base64 = await fileToBase64(file);
         filePart = { mimeType: file.type, data: base64 };
      }

      const importedUsers = await parseUserList(filePart, textContent);
      
      if (importedUsers && importedUsers.length > 0) {
        const existingUsernames = new Set(users.map(u => u.username));
        const newUsers = (importedUsers || []).map(u => {
           let baseUsername = (u.name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
           let uniqueUsername = baseUsername;
           let counter = 1;
           while (existingUsernames.has(uniqueUsername)) {
              uniqueUsername = `${baseUsername}${counter}`;
              counter++;
           }
           existingUsernames.add(uniqueUsername);

           return {
             id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
             organizationId: orgId,
             name: u.name || 'Unknown',
             username: uniqueUsername,
             password: '123456',
             email: u.email || `${uniqueUsername}@nexus.com`,
             role: u.role || UserRole.EMPLOYEE,
             department: u.department || 'Imported',
             avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`
           };
        }) as User[];
        setUsers([...users, ...newUsers]);
        alert(`成功导入 ${newUsers.length} 名用户。`);
      }
    } catch (err) {
      console.error(err);
      alert("导入失败");
    } finally {
      setImportingUsers(false);
      e.target.value = '';
    }
  };

  const handleSaveUser = () => {
    if (!newUser.name || !newUser.username) return;

    if (editingUserId) {
      setUsers(users.map(u => u.id === editingUserId ? { ...u, ...newUser } as User : u));
    } else {
      const user: User = {
        id: `u-${Date.now()}`,
        organizationId: orgId,
        name: newUser.name!,
        username: newUser.username!,
        email: `${newUser.username}@${orgId}.com`,
        role: newUser.role as UserRole,
        department: newUser.department || 'General',
        password: newUser.password || '123456',
        managerId: newUser.managerId,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.username}`
      };
      setUsers([...users, user]);
    }
    setNewUser({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456', managerId: '' });
    setEditingUserId(null);
    setShowAddUser(false);
  };

  const handleDeleteUser = (userId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '删除用户确认',
      message: '确定要删除该用户吗？此操作不可撤销，且该用户相关的考核记录（自评、他评）都将被一并移除。',
      onConfirm: () => {
        setUsers(users.filter(u => u.id !== userId));
        setAssignments(assignments.filter(a => a.reviewerId !== userId && a.subjectId !== userId));
        setConfirmConfig(null);
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '重置密码',
      message: '确定重置为默认密码 "123456" 吗？',
      onConfirm: () => {
        setUsers(users.map(u => u.id === userId ? { ...u, password: '123456' } : u));
        setConfirmConfig(null);
      }
    });
  };

  const startEditUser = (user: User) => {
    setNewUser({
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      password: user.password || '123456',
      managerId: user.managerId || ''
    });
    setEditingUserId(user.id);
    setShowAddUser(true);
  };

  const filteredAssignments = useMemo(() => {
     if (!filterUserId) return assignments;
     return assignments.filter(a => a.reviewerId === filterUserId || a.subjectId === filterUserId);
  }, [assignments, filterUserId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统管理控制台</h2>
          <p className="text-sm text-slate-500">当前管理企业: <span className="font-bold text-blue-600">{orgId}</span></p>
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['users', 'relations', 'questions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeSubTab === tab 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'users' && '用户管理 (User Management)'}
            {tab === 'relations' && '考核关系配置 (Config)'}
            {tab === 'questions' && '测评试题开发'}
          </button>
        ))}
      </div>

      {activeSubTab === 'users' && (
        <Card className="p-6">
           <InstructionAlert title="操作重要提示">
              请在此维护企业完整的组织架构。<strong>务必正确设置每位员工的“直属上级”</strong>，系统后续将依据此信息自动生成“上级评价”和“下级评价”的考核关系。
           </InstructionAlert>

           {/* Reuse existing UI logic but bind to handlers above */}
           <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-slate-800">人员名单管理</h3>
               <div className="flex gap-2">
                  <Button variant="primary" className="text-sm" onClick={() => {
                    setEditingUserId(null);
                    setNewUser({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456', managerId: '' });
                    setShowAddUser(!showAddUser);
                  }}>
                    {showAddUser ? '取消' : '+ 添加用户'}
                  </Button>
               </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">批量操作:</span>
               <label className="cursor-pointer bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded text-sm font-medium flex items-center transition-colors">
                  <Icons.Upload /> <span className="ml-1.5">{importingUsers ? '导入中...' : '导入名单'}</span>
                  <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportUsers} disabled={importingUsers} />
               </label>
               <div className="h-6 w-px bg-slate-300 mx-1"></div>
               <Button variant="secondary" className="text-sm py-1.5" onClick={handleBatchGeneratePasswords}><Icons.Key /> <span className="ml-1">批量重置密码</span></Button>
               <Button variant="secondary" className="text-sm py-1.5" onClick={handleExportCredentials}><Icons.Download /> <span className="ml-1">导出凭证</span></Button>
            </div>
          </div>

          {showAddUser && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
               <h4 className="text-sm font-bold text-slate-700 mb-3">{editingUserId ? '编辑用户' : '新增用户'}</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">姓名 <span className="text-red-500">*</span></label>
                  <input placeholder="例如: 张三" className="w-full p-2 border rounded text-sm" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">登录用户名 <span className="text-red-500">*</span></label>
                  <input placeholder="例如: zhangsan" className="w-full p-2 border rounded text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">初始密码</label>
                  <input placeholder="默认: 123456" className="w-full p-2 border rounded text-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">所属部门</label>
                  <input placeholder="例如: 研发部" className="w-full p-2 border rounded text-sm" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">系统角色</label>
                  <select className="w-full p-2 border rounded text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                     <option value={UserRole.EMPLOYEE}>普通员工 (Employee)</option>
                     <option value={UserRole.MANAGER}>部门经理 (Manager)</option>
                     <option value={UserRole.ADMIN}>管理员 (Admin)</option>
                   </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">直属上级 (Direct Manager)</label>
                  <select 
                    className="w-full p-2 border rounded text-sm bg-white" 
                    value={newUser.managerId || ''} 
                    onChange={e => setNewUser({...newUser, managerId: e.target.value})}
                  >
                     <option value="">-- 无 / 请选择 --</option>
                     {users.filter(u => u.id !== editingUserId).map(u => (
                       <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                     ))}
                   </select>
                   <p className="text-[10px] text-slate-400 mt-1">设置上级有助于自动生成"下级评价上级"和"上级评价下级"的考核关系。</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                 <Button variant="secondary" onClick={() => setShowAddUser(false)}>取消</Button>
                 <Button onClick={handleSaveUser}>{editingUserId ? '更新信息' : '确认保存'}</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">姓名 / 账号</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">部门 & 角色</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">直属上级 <span className="text-red-500">*</span></th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">密码</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map(u => {
                  const manager = users.find(m => m.id === u.managerId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <img className="h-8 w-8 rounded-full bg-slate-200" src={u.avatarUrl} alt="" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{u.department}</div>
                        <Badge color={u.role === 'ADMIN' ? 'red' : u.role === 'MANAGER' ? 'blue' : 'gray'}>{u.role}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {manager ? (
                          <span className="flex items-center text-slate-700">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            {manager.name}
                          </span>
                        ) : <span className="text-red-400 italic text-xs border border-red-200 bg-red-50 px-2 py-1 rounded">未设置</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-xs">{u.password || '123456'}</code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleResetPassword(u.id)} className="text-yellow-600 hover:text-yellow-800 p-1" title="重置密码"><Icons.Refresh /></button>
                          <button onClick={() => startEditUser(u)} className="text-blue-600 hover:text-blue-900 p-1" title="编辑用户"><Icons.Edit /></button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-900 p-1" title="删除用户"><Icons.Trash /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeSubTab === 'relations' && (
        <div className="space-y-6">
           <Card className="p-6 bg-gradient-to-r from-blue-50 to-white border-blue-100">
             <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-800">智能生成考核关系</h3>
                <p className="text-sm text-slate-600 mt-1">
                  系统将根据【用户管理】中设定的部门和直属上级关系，自动生成 360° 评价任务（包含自评、上级评价、下级评价及同事互评）。
                </p>
             </div>
             <div className="space-y-4">
                <div className="flex gap-3 pt-2">
                  <div className="relative overflow-hidden inline-block">
                     <Button variant="primary"><Icons.Upload /> <span className="ml-2">上传架构图 (AI 辅助)</span></Button>
                     <input id="orgChartFile" type="file" className="absolute top-0 left-0 opacity-0 w-full h-full cursor-pointer" onChange={handleImportOrgChart} />
                  </div>
                  <Button onClick={handleGenerateRelationships} isLoading={generatingRel} variant="secondary">一键生成关系</Button>
                </div>
                <p className="text-xs text-slate-400">提示：如果您已在“用户管理”中完善了汇报关系，直接点击“一键生成”即可。</p>
             </div>
           </Card>
           <Card className="p-6">
             <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h3 className="text-lg font-bold text-slate-800">考核关系矩阵 ({filteredAssignments.length})</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">按人员筛选:</span>
                <select 
                  className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                >
                  <option value="">全部显示</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
             </div>
             {/* Table for assignments */}
             <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">被考核人 (Subject)</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">考核人 (Reviewer)</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500">关系类型</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAssignments.map(a => {
                     const subject = users.find(u => u.id === a.subjectId);
                     const reviewer = users.find(u => u.id === a.reviewerId);
                     return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm">
                          <span className="font-medium text-slate-900">{subject?.name || a.subjectId}</span>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span className="text-slate-600">{reviewer?.name || a.reviewerId}</span>
                        </td>
                        <td className="px-6 py-3 text-sm"><Badge>{a.relationship}</Badge></td>
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteAssignment(a.id)} 
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                     );
                  })}
                  {filteredAssignments.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">没有找到相关考核记录</td></tr>
                  )}
                </tbody>
              </table>
            </div>
           </Card>
        </div>
      )}

      {activeSubTab === 'questions' && (
        <div className="space-y-6">
           <Card className="p-6">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">问卷题库管理</h3>
                  <p className="text-xs text-slate-500 mt-1">您可以直接修改下方的维度标签和题目内容，变更将实时保存。</p>
                </div>
                <Button onClick={handleAddQuestion} variant="secondary">+ 添加新题目</Button>
             </div>
             <div className="space-y-4">
               {questions.map((q, idx) => (
                 <div key={q.id} className="group flex items-start space-x-4 p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm mt-1">
                     {idx + 1}
                   </div>
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Editable Category */}
                      <div className="md:col-span-3">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">维度</label>
                         <input
                           className="w-full text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border-transparent focus:border-blue-300 focus:bg-white focus:ring-0 transition-colors"
                           value={q.category}
                           onChange={(e) => updateQuestion(q.id, 'category', e.target.value)}
                           placeholder="维度名称"
                         />
                      </div>
                      {/* Editable Text */}
                      <div className="md:col-span-9">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">题目内容</label>
                         <textarea 
                           className="w-full bg-transparent border-b border-slate-200 focus:border-blue-500 text-sm py-1 resize-none focus:outline-none"
                           rows={2}
                           value={q.text}
                           onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                           placeholder="请输入考核题目描述..."
                         />
                      </div>
                   </div>
                   <button 
                     onClick={() => deleteQuestion(q.id)} 
                     className="text-slate-300 hover:text-red-500 transition-colors pt-2"
                     title="删除此题"
                   >
                     <Icons.Trash />
                   </button>
                 </div>
               ))}
             </div>
           </Card>
        </div>
      )}

      {confirmConfig && (
        <ConfirmDialog 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}

const App = () => {
  // Global Data State
  const [orgs, setOrgs] = useState<Organization[]>(MOCK_ORGS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [cycles, setCycles] = useState<ReviewCycle[]>(INITIAL_CYCLES);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>(INITIAL_ASSIGNMENTS);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);

  // Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-reviews' | 'team-reports' | 'admin'>('dashboard');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Derived
  const currentOrg = useMemo(() => 
    currentUser ? orgs.find(o => o.id === currentUser.organizationId) : null, 
    [currentUser, orgs]
  );
  
  const currentCycle = useMemo(() => 
    currentUser ? cycles.find(c => c.organizationId === currentUser.organizationId && c.status === 'ACTIVE') : null,
    [currentUser, cycles]
  );

  const handleLogin = (orgCode: string, u: string, p: string) => {
     const org = orgs.find(o => o.code === orgCode);
     if (!org) { setLoginError("找不到该企业代码"); return; }
     
     const user = users.find(user => user.organizationId === org.id && user.username === u);
     if (!user) { setLoginError("用户不存在"); return; }
     if (user.password !== p) { setLoginError("密码错误"); return; }
     
     setCurrentUser(user);
     setLoginError(null);
     setActiveTab('dashboard');
  };

  const handleRegister = (orgName: string, orgCode: string, adminName: string, adminUser: string, adminPass: string) => {
     if (orgs.some(o => o.code === orgCode)) { setLoginError("该企业代码已被占用"); return; }
     
     const newOrg: Organization = {
        id: `org-${Date.now()}`,
        name: orgName,
        code: orgCode,
        recoveryKey: generateRecoveryKey(),
        createdAt: new Date().toISOString()
     };
     
     const newAdmin: User = {
        id: `u-${Date.now()}`,
        organizationId: newOrg.id,
        name: adminName,
        username: adminUser,
        password: adminPass,
        email: `${adminUser}@${orgCode}.com`,
        role: UserRole.ADMIN,
        department: 'Management',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${adminUser}`
     };
     
     // Create default cycle
     const newCycle: ReviewCycle = {
        id: `c-${Date.now()}`,
        organizationId: newOrg.id,
        name: `${new Date().getFullYear()} Q1 Performance Review`,
        status: 'ACTIVE',
        dueDate: '2025-03-31'
     };

     setOrgs([...orgs, newOrg]);
     setUsers([...users, newAdmin]);
     setCycles([...cycles, newCycle]);
     
     // Auto login
     setCurrentUser(newAdmin);
     alert(`注册成功！请保存您的恢复密钥: ${newOrg.recoveryKey}`);
  };

  const handleRecover = (orgCode: string, key: string, newPass: string) => {
     const org = orgs.find(o => o.code === orgCode);
     if (!org || org.recoveryKey !== key) { alert("恢复失败：企业代码或密钥错误"); return; }
     
     const admin = users.find(u => u.organizationId === org.id && u.role === UserRole.ADMIN);
     if (!admin) { alert("系统错误：未找到管理员账户"); return; }
     
     const updatedUsers = users.map(u => u.id === admin.id ? { ...u, password: newPass } : u);
     setUsers(updatedUsers);
     alert("管理员密码重置成功，请使用新密码登录。");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginError(null);
  };

  const handleSubmitReview = (assignmentId: string, scores: Record<string, number>, comments: Record<string, string>, strengths: string, improvements: string) => {
     setAssignments(prev => prev.map(a => 
       a.id === assignmentId 
         ? { ...a, scores, comments, feedbackStrengths: strengths, feedbackImprovements: improvements, status: EvaluationStatus.SUBMITTED, submittedAt: new Date().toISOString() } 
         : a
     ));
  };
  
  const handleChangePassword = (oldP: string, newP: string) => {
     if (currentUser?.password !== oldP) { alert("旧密码错误"); return; }
     setUsers(users.map(u => u.id === currentUser.id ? { ...u, password: newP } : u));
     setCurrentUser({ ...currentUser, password: newP });
     setShowPasswordModal(false);
     alert("密码修改成功");
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} onRecover={handleRecover} error={loginError} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">N</div>
          <span className="font-bold text-lg tracking-tight">Nexus360</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />}>
            工作台 (Dashboard)
          </NavButton>
          <NavButton active={activeTab === 'my-reviews'} onClick={() => setActiveTab('my-reviews')} icon={<Icons.List />}>
            我的评估 (Reviews)
            {assignments.filter(a => a.reviewerId === currentUser.id && a.status !== 'SUBMITTED').length > 0 && (
              <span className="ml-auto bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs font-bold">
                {assignments.filter(a => a.reviewerId === currentUser.id && a.status !== 'SUBMITTED').length}
              </span>
            )}
          </NavButton>
          {(currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN) && (
            <NavButton active={activeTab === 'team-reports'} onClick={() => setActiveTab('team-reports')} icon={<Icons.Chart />}>
              团队报告 (Reports)
            </NavButton>
          )}
          {currentUser.role === UserRole.ADMIN && (
            <>
              <div className="pt-4 pb-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Administration</div>
              <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Icons.Settings />}>
                系统设置 (Settings)
              </NavButton>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center mb-3">
              <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="ml-3 overflow-hidden">
                 <p className="text-sm font-medium text-slate-900 truncate">{currentUser.name}</p>
                 <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowPasswordModal(true)} className="text-xs text-slate-500 hover:text-blue-600 text-left">修改密码</button>
              <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-600 text-right">退出登录</button>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center">
           <div className="font-bold">Nexus360</div>
           <button onClick={handleLogout} className="text-sm text-slate-500">退出</button>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
           <div className="max-w-6xl mx-auto">
             {activeTab === 'dashboard' && <Dashboard user={currentUser} users={users.filter(u => u.organizationId === currentUser.organizationId)} assignments={assignments.filter(a => a.organizationId === currentUser.organizationId)} setTab={setActiveTab} />}
             
             {activeTab === 'my-reviews' && <MyReviewsList user={currentUser} users={users.filter(u => u.organizationId === currentUser.organizationId)} assignments={assignments.filter(a => a.organizationId === currentUser.organizationId)} questions={questions} onSubmit={handleSubmitReview} />}
             
             {activeTab === 'team-reports' && (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN) && 
                <TeamReports user={currentUser} users={users.filter(u => u.organizationId === currentUser.organizationId)} assignments={assignments.filter(a => a.organizationId === currentUser.organizationId)} questions={questions} sharedReports={[]} onToggleShare={() => {}} />
             }
             
             {activeTab === 'admin' && currentUser.role === UserRole.ADMIN && currentCycle && (
                <AdminConsole 
                   users={users.filter(u => u.organizationId === currentUser.organizationId)} 
                   setUsers={(newOrgUsers) => {
                      // Merge logic: Remove old users of this org, add new ones
                      const otherUsers = users.filter(u => u.organizationId !== currentUser.organizationId);
                      setUsers([...otherUsers, ...newOrgUsers]);
                   }}
                   questions={questions} // Global for now, can be org specific if filtered
                   setQuestions={setQuestions}
                   assignments={assignments.filter(a => a.organizationId === currentUser.organizationId)}
                   setAssignments={(newOrgAssigns) => {
                      const otherAssigns = assignments.filter(a => a.organizationId !== currentUser.organizationId);
                      setAssignments([...otherAssigns, ...newOrgAssigns]);
                   }}
                   cycle={currentCycle}
                   setCycle={(c) => setCycles(cycles.map(cy => cy.id === c.id ? c : cy))}
                   currentUser={currentUser}
                   orgId={currentUser.organizationId}
                />
             )}
           </div>
        </main>
      </div>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} onSave={handleChangePassword} />
    </div>
  );
};

export default App;