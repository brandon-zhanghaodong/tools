import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserRole, 
  User, 
  ReviewCycle, 
  ReviewAssignment, 
  Relationship, 
  EvaluationStatus,
  Question
} from './types';
import { Card, Button, Badge, InstructionAlert } from './components/UIComponents';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { generateFeedbackSummary, generateReviewRelationships, generateQuestionnaire, parseOrgChartToRelationships, parseUserList } from './services/geminiService';

// --- Helper Functions ---
const generateRandomPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // Removed confusing chars like i, l, 1, o, 0
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

// --- Mock Data ---
// Updated to generic professional roles with passwords
const MOCK_USERS: User[] = [
  { id: 'u1', name: '系统管理员 (Administrator)', username: 'admin', password: '123', email: 'admin@nexus.com', role: UserRole.ADMIN, department: '人力资源部', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin' },
  { id: 'u2', name: '研发总监 (Director)', username: 'director', password: '123', email: 'director@nexus.com', role: UserRole.MANAGER, department: '技术部', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Manager' },
  { id: 'u3', name: '高级工程师 A (Senior Eng)', username: 'engineer_a', password: '123', email: 'eng.a@nexus.com', role: UserRole.EMPLOYEE, department: '技术部', managerId: 'u2', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=EngA' },
  { id: 'u4', name: 'UI/UX 设计师 (Designer)', username: 'designer', password: '123', email: 'design@nexus.com', role: UserRole.EMPLOYEE, department: '设计部', managerId: 'u2', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Designer' },
  { id: 'u5', name: '产品经理 (Product Lead)', username: 'pm_lead', password: '123', email: 'pm@nexus.com', role: UserRole.EMPLOYEE, department: '产品部', managerId: 'u2', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PM' },
];

// Based on PDF Page 15-19 examples
const INITIAL_QUESTIONS: Question[] = [
  { id: 'q1', category: '诚信正直', text: '公正对待团队成员' },
  { id: 'q2', category: '诚信正直', text: '巨大压力或诱惑下坚持原则' },
  { id: 'q3', category: '学习创新', text: '主动寻求他人对自己的反馈/评价' },
  { id: 'q4', category: '学习创新', text: '借鉴标杆，尝试创新' },
  { id: 'q5', category: '战略思维', text: '清晰传达公司战略目标' },
  { id: 'q6', category: '组织优化', text: '提出改进组织流程的建议' },
  { id: 'q7', category: '人才开发', text: '识别他人的优势或不足' },
];

const INITIAL_CYCLE: ReviewCycle = {
  id: 'c1',
  name: '2025年 领导力素质360度评估',
  status: 'ACTIVE',
  dueDate: '2025-11-30',
};

// Initial assignments
const INITIAL_ASSIGNMENTS: ReviewAssignment[] = [
  {
    id: 'a1', cycleId: 'c1', reviewerId: 'u3', subjectId: 'u3', relationship: Relationship.SELF, status: EvaluationStatus.PENDING, scores: {}, comments: {}, feedbackStrengths: '', feedbackImprovements: ''
  },
  {
    id: 'a2', cycleId: 'c1', reviewerId: 'u2', subjectId: 'u3', relationship: Relationship.MANAGER, status: EvaluationStatus.SUBMITTED, 
    scores: { q1: 4, q2: 5, q3: 3, q4: 4, q5: 3, q6: 4, q7: 4 }, 
    comments: {}, 
    feedbackStrengths: "事业激情高，团队合作意识强。",
    feedbackImprovements: "执行力需要加强，战略思维有待提升。"
  },
  {
    id: 'a3', cycleId: 'c1', reviewerId: 'u4', subjectId: 'u3', relationship: Relationship.PEER, status: EvaluationStatus.SUBMITTED,
    scores: { q1: 5, q2: 4, q3: 4, q4: 4, q5: 2, q6: 3, q7: 5 },
    comments: {},
    feedbackStrengths: "敬业、努力、专心；对事业执着。",
    feedbackImprovements: "统筹协调能力，规划计划能力。"
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
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
};

// --- Confirm Dialog ---
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

// --- Change Password Dialog ---
const ChangePasswordModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (o: string, n: string) => void }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <span className="bg-blue-100 text-blue-600 p-1.5 rounded-full mr-2">
            <Icons.Key />
          </span>
          修改密码
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">当前密码</label>
            <input 
              type="password" 
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              value={oldPass} 
              onChange={e => setOldPass(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">新密码</label>
            <input 
              type="password" 
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              value={newPass} 
              onChange={e => setNewPass(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">确认新密码</label>
            <input 
              type="password" 
              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              value={confirmPass} 
              onChange={e => setConfirmPass(e.target.value)} 
            />
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

// --- Navigation Button ---
const NavButton = ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children?: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <span className={`flex-shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
      {icon}
    </span>
    <span className="ml-3 flex-1 text-left flex items-center">
      {children}
    </span>
  </button>
);

// --- Login Screen ---
const LoginScreen = ({ onLogin, error }: { onLogin: (u: string, p: string) => void, error: string | null }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-xl mb-4">
          <span className="font-bold text-2xl text-white">N</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">Nexus360 测评系统</h2>
        <p className="mt-2 text-center text-sm text-slate-600">企业级 360 度绩效评估平台</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                用户名 (Username)
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="请输入您的账号"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                密码 (Password)
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="请输入您的密码"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                登录系统
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              如忘记密码或无法登录，请联系人力资源部管理员重置。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Components ---

const Dashboard = ({ user, users, assignments, setTab }: { user: User, users: User[], assignments: ReviewAssignment[], setTab: (t: any) => void }) => {
  const pendingReviews = assignments.filter(a => a.reviewerId === user.id && a.status === EvaluationStatus.PENDING);
  const completedReviews = assignments.filter(a => a.reviewerId === user.id && a.status === EvaluationStatus.SUBMITTED);
  const myFeedback = assignments.filter(a => a.subjectId === user.id && a.status === EvaluationStatus.SUBMITTED);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Icons.List />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">待办评估</p>
              <p className="text-2xl font-bold text-slate-900">{pendingReviews.length}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => setTab('my-reviews')} className="text-sm p-0 h-auto">
              去处理 &rarr;
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-500">已完成评估</p>
              <p className="text-2xl font-bold text-slate-900">{completedReviews.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-purple-500">
          <div className="flex items-center">
             <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Icons.Chart />
             </div>
             <div className="ml-4">
               <p className="text-sm font-medium text-slate-500">收到的反馈</p>
               <p className="text-2xl font-bold text-slate-900">{myFeedback.length}</p>
             </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">待办事项</h3>
        {pendingReviews.length > 0 ? (
          <div className="space-y-3">
            {pendingReviews.map(r => {
               const subject = users.find(u => u.id === r.subjectId);
               return (
                 <div key={r.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg bg-slate-50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg">
                        {subject?.avatarUrl ? <img src={subject.avatarUrl} className="w-full h-full rounded-full"/> : (subject?.name[0] || '?')}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-bold text-slate-900">评价: {subject?.name}</p>
                        <p className="text-xs text-slate-500">关系: {r.relationship}</p>
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => setTab('my-reviews')}>开始评估</Button>
                 </div>
               )
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">暂无待办事项，做得好！</p>
        )}
      </Card>
    </div>
  );
};

const MyReviewsList = ({ user, users, assignments, questions, onSubmit }: { user: User, users: User[], assignments: ReviewAssignment[], questions: Question[], onSubmit: any }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const pendingReviews = assignments.filter(a => a.reviewerId === user.id && a.status === EvaluationStatus.PENDING);
  const submittedReviews = assignments.filter(a => a.reviewerId === user.id && a.status === EvaluationStatus.SUBMITTED);

  const initForm = (assignment: ReviewAssignment) => {
    setFormData({
      scores: assignment.scores || {},
      comments: assignment.comments || {},
      feedbackStrengths: assignment.feedbackStrengths || '',
      feedbackImprovements: assignment.feedbackImprovements || ''
    });
    setExpandedId(assignment.id);
  };

  const handleScoreChange = (qId: string, score: number) => {
    setFormData({ ...formData, scores: { ...formData.scores, [qId]: score } });
  };

  const submit = (id: string) => {
    onSubmit(id, formData.scores, formData.comments, formData.feedbackStrengths, formData.feedbackImprovements);
    setExpandedId(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <span className="w-2 h-8 bg-blue-600 rounded-full mr-3"></span>
          待评估 ({pendingReviews.length})
        </h3>
        <div className="space-y-4">
          {pendingReviews.map(r => {
             const subject = users.find(u => u.id === r.subjectId);
             const isExpanded = expandedId === r.id;
             
             return (
               <Card key={r.id} className={`transition-all ${isExpanded ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
                 <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => !isExpanded && initForm(r)}>
                    <div className="flex items-center">
                      <img src={subject?.avatarUrl} className="w-10 h-10 rounded-full bg-slate-100" />
                      <div className="ml-3">
                        <p className="font-bold text-slate-900">{subject?.name}</p>
                        <p className="text-xs text-slate-500">关系: <Badge>{r.relationship}</Badge></p>
                      </div>
                    </div>
                    <div>
                      {isExpanded ? (
                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}>收起</Button>
                      ) : (
                        <Button variant="primary">去评估</Button>
                      )}
                    </div>
                 </div>
                 
                 {isExpanded && (
                   <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                     <InstructionAlert title="评分说明">
                       请根据被评价人在考核周期内的实际行为表现进行客观评分（1-5分）。5分代表卓越，3分代表达标，1分代表亟需改进。
                     </InstructionAlert>
                     
                     <div className="space-y-6">
                        {questions.map(q => (
                          <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200">
                             <div className="mb-2">
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{q.category}</span>
                               <p className="text-slate-900 font-medium mt-1">{q.text}</p>
                             </div>
                             <div className="flex items-center space-x-4 mt-3">
                               {[1,2,3,4,5].map(score => (
                                 <label key={score} className={`flex flex-col items-center cursor-pointer p-2 rounded transition-colors ${formData.scores?.[q.id] === score ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-50'}`}>
                                   <input 
                                     type="radio" 
                                     name={`q-${q.id}`} 
                                     value={score} 
                                     checked={formData.scores?.[q.id] === score}
                                     onChange={() => handleScoreChange(q.id, score)}
                                     className="hidden"
                                   />
                                   <span className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 bg-white mb-1">
                                     {score}
                                   </span>
                                   <span className="text-xs text-slate-500">
                                     {score === 1 ? '差' : score === 5 ? '优' : ''}
                                   </span>
                                 </label>
                               ))}
                             </div>
                          </div>
                        ))}

                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                           <h4 className="font-bold text-slate-800 mb-3">综合评语</h4>
                           <div className="space-y-4">
                             <div>
                               <label className="block text-sm font-medium text-slate-700 mb-1">该员工的主要优势 (Strengths)</label>
                               <textarea 
                                 className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                 rows={3}
                                 value={formData.feedbackStrengths}
                                 onChange={e => setFormData({...formData, feedbackStrengths: e.target.value})}
                                 placeholder="例如：具备很强的责任心..."
                               />
                             </div>
                             <div>
                               <label className="block text-sm font-medium text-slate-700 mb-1">建议改进的方面 (Improvements)</label>
                               <textarea 
                                 className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                                 rows={3}
                                 value={formData.feedbackImprovements}
                                 onChange={e => setFormData({...formData, feedbackImprovements: e.target.value})}
                                 placeholder="例如：建议加强跨部门沟通..."
                               />
                             </div>
                           </div>
                        </div>
                     </div>

                     <div className="mt-6 flex justify-end">
                       <Button onClick={() => submit(r.id)}>提交评估</Button>
                     </div>
                   </div>
                 )}
               </Card>
             );
          })}
          {pendingReviews.length === 0 && <p className="text-slate-500 italic">所有评估已完成。</p>}
        </div>
      </div>

      <div className="pt-8 border-t border-slate-200">
        <h3 className="text-lg font-bold text-slate-400 mb-4">已提交的历史记录</h3>
        <div className="opacity-75">
          {submittedReviews.map(r => {
             const subject = users.find(u => u.id === r.subjectId);
             return (
               <div key={r.id} className="flex items-center justify-between p-4 border-b border-slate-100">
                  <div className="flex items-center">
                     <span className="text-green-500 mr-3"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>
                     <p className="text-slate-600">已评价 <span className="font-bold">{subject?.name}</span></p>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(r.submittedAt || '').toLocaleDateString()}</span>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
};

const TeamReports = ({ user, users, assignments, questions, sharedReports, onToggleShare }: { 
  user: User, 
  users: User[], 
  assignments: ReviewAssignment[], 
  questions: Question[],
  sharedReports: Set<string>,
  onToggleShare: (id: string) => void 
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine who calls who
  // If user is Admin, can see all. If Manager, can see direct reports and self.
  // Add shared users to the visible list
  const myTeam = users.filter(u => 
    user.role === UserRole.ADMIN || 
    u.managerId === user.id || 
    u.id === user.id ||
    sharedReports.has(u.id)
  );

  const generateReport = async (subjectId: string) => {
    setLoading(true);
    setSelectedSubjectId(subjectId);
    setReport(null);
    
    // Find all reviews for this subject
    const subjectReviews = assignments.filter(a => a.subjectId === subjectId && a.status === EvaluationStatus.SUBMITTED);
    
    if (subjectReviews.length === 0) {
      setLoading(false);
      return;
    }

    const subject = users.find(u => u.id === subjectId);

    // Calculate Scores
    // Average per category
    const catScores: Record<string, { total: number, count: number, selfTotal: number }> = {};
    
    subjectReviews.forEach(r => {
       Object.entries(r.scores).forEach(([qId, score]) => {
          const q = questions.find(qu => qu.id === qId);
          if (q && score > 0) {
            if (!catScores[q.category]) catScores[q.category] = { total: 0, count: 0, selfTotal: 0 };
            
            if (r.relationship === Relationship.SELF) {
              catScores[q.category].selfTotal = score;
            } else {
              catScores[q.category].total += score;
              catScores[q.category].count += 1;
            }
          }
       });
    });

    const categoryScores = Object.entries(catScores).map(([cat, val]) => ({
      category: cat,
      score: val.count > 0 ? parseFloat((val.total / val.count).toFixed(1)) : 0,
      selfScore: val.selfTotal || 0,
      fullMark: 5
    }));

    // Generate AI Summary
    const aiSummary = await generateFeedbackSummary(subjectReviews, questions, subject?.name || '');

    setReport({
      subjectId: subjectId,
      subjectName: subject?.name,
      categoryScores,
      ...aiSummary
    });
    setLoading(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-150px)]">
       {/* Sidebar List */}
       <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
         <div className="p-4 bg-white border-b border-slate-200 font-bold text-slate-700">团队成员</div>
         <div className="flex-1 overflow-y-auto p-2 space-y-2">
           {myTeam.map(u => (
             <button
               key={u.id}
               onClick={() => generateReport(u.id)}
               className={`w-full text-left p-3 rounded-lg flex items-center transition-colors ${selectedSubjectId === u.id ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-white hover:shadow-sm'}`}
             >
               <div className="relative">
                 <img src={u.avatarUrl} className="w-8 h-8 rounded-full bg-white" />
                 {sharedReports.has(u.id) && (
                    <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 border border-white" title="已公开">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </div>
                 )}
               </div>
               <div className="ml-3">
                 <p className={`text-sm font-bold ${selectedSubjectId === u.id ? 'text-blue-800' : 'text-slate-800'}`}>{u.name}</p>
                 <p className="text-xs text-slate-500">{u.role}</p>
               </div>
             </button>
           ))}
         </div>
       </div>

       {/* Main Report Area */}
       <div className="flex-1 bg-white border border-slate-200 rounded-lg p-6 overflow-y-auto">
         {!selectedSubjectId ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
             <Icons.Chart />
             <p className="mt-2">请选择左侧成员查看报告</p>
           </div>
         ) : loading ? (
           <div className="h-full flex flex-col items-center justify-center text-blue-500">
             <svg className="animate-spin h-8 w-8 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
             <p>AI 正在分析反馈数据生成报告...</p>
           </div>
         ) : report ? (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-end border-b border-slate-100 pb-4">
               <div>
                 <h2 className="text-2xl font-bold text-slate-900">{report.subjectName} 的 360 评估报告</h2>
                 <p className="text-slate-500 text-sm mt-1">生成时间: {new Date().toLocaleDateString()}</p>
               </div>
               <div className="flex items-center space-x-3">
                 {user.role === UserRole.ADMIN && (
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                       <span className="text-xs font-medium text-slate-600">全员可见:</span>
                       <button 
                         onClick={() => onToggleShare(report.subjectId)}
                         className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${sharedReports.has(report.subjectId) ? 'bg-blue-600' : 'bg-slate-300'}`}
                       >
                         <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sharedReports.has(report.subjectId) ? 'translate-x-4' : 'translate-x-1'}`} />
                       </button>
                    </div>
                 )}
                 <Button variant="secondary" onClick={() => window.print()}>打印报告</Button>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="h-64">
                 <h3 className="font-bold text-slate-700 mb-4 text-center">能力维度雷达图</h3>
                 <ResponsiveContainer width="100%" height="100%">
                   <RadarChart cx="50%" cy="50%" outerRadius="80%" data={report.categoryScores}>
                     <PolarGrid />
                     <PolarAngleAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 12 }} />
                     <PolarRadiusAxis angle={30} domain={[0, 5]} />
                     <Radar name="他人评价" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                     <Radar name="自评" dataKey="selfScore" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeDasharray="3 3" />
                     <Legend />
                     <Tooltip />
                   </RadarChart>
                 </ResponsiveContainer>
               </div>
               
               <div className="space-y-6">
                 <div>
                    <h3 className="font-bold text-slate-700 mb-2 flex items-center">
                       <span className="p-1 bg-blue-100 text-blue-600 rounded mr-2"><Icons.Sparkles/></span>
                       AI 综合点评
                    </h3>
                    <div className="bg-blue-50/50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed border border-blue-100">
                      {report.summary}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <h4 className="font-bold text-green-800 text-sm mb-2">优势 (Strengths)</h4>
                      <ul className="list-disc list-inside text-xs text-green-700 space-y-1">
                        {report.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                   </div>
                   <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                      <h4 className="font-bold text-yellow-800 text-sm mb-2">建议改进 (Improvements)</h4>
                      <ul className="list-disc list-inside text-xs text-yellow-700 space-y-1">
                        {report.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                   </div>
                 </div>
               </div>
             </div>
             
             <div className="bg-slate-50 p-6 rounded-lg">
                <h3 className="font-bold text-slate-700 mb-4">详细得分</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {report.categoryScores.map((c: any) => (
                    <div key={c.category} className="bg-white p-3 rounded shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">{c.category}</p>
                      <div className="flex justify-between items-end">
                        <span className="text-xl font-bold text-slate-900">{c.score}</span>
                        <span className="text-xs text-slate-400">自评: {c.selfScore}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(c.score / 5) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
           </div>
         ) : (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
             <p>暂无数据</p>
           </div>
         )}
       </div>
    </div>
  );
};

// --- Admin Console ---

const AdminConsole = ({ 
  users, 
  setUsers,
  questions, 
  setQuestions,
  assignments, 
  setAssignments,
  cycle,
  setCycle,
  currentUser
}: { 
  users: User[], 
  setUsers: React.Dispatch<React.SetStateAction<User[]>>,
  questions: Question[], 
  setQuestions: (q: Question[]) => void,
  assignments: ReviewAssignment[],
  setAssignments: React.Dispatch<React.SetStateAction<ReviewAssignment[]>>,
  cycle: ReviewCycle,
  setCycle: (c: ReviewCycle) => void,
  currentUser: User
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'relations' | 'questions'>('relations');
  const [generatingRel, setGeneratingRel] = useState(false);
  const [generatingQ, setGeneratingQ] = useState(false);
  const [importText, setImportText] = useState('');
  const [importingOrg, setImportingOrg] = useState(false);
  const [importingUsers, setImportingUsers] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  // User Management State
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456' });

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
      message: '确定要为所有用户（除当前管理员外）重新生成随机的 8 位密码吗？此操作将覆盖现有密码，请务必在操作后导出账号凭证。',
      onConfirm: () => {
        setUsers(prev => prev.map(u => {
          // Don't reset if it's the current admin user to prevent lockout
          if (u.id === currentUser.id) return u; 
          return { ...u, password: generateRandomPassword() };
        }));
        setConfirmConfig(null);
        alert("已成功为所有员工生成新的随机密码！请立即点击“导出账号凭证”保存。");
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
    const newRels = await generateReviewRelationships(users, cycle.id);
    setAssignments(newRels);
    setGeneratingRel(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
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
        setAssignments(prev => prev.filter(a => a.id !== id));
        setConfirmConfig(null);
      }
    });
  };

  const handleAddQuestion = () => {
    const newId = `q-custom-${Date.now()}`;
    setQuestions([...questions, {
      id: newId,
      category: '自定义维度',
      text: '请在此输入新的考核题目...'
    }]);
  };

  const handleImportOrgChart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Check for file input
    const fileInput = document.getElementById('orgChartFile') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!importText.trim() && !file) {
      alert("请上传文件或输入文本描述以开始导入。");
      return;
    }

    if (file && file.size > 5 * 1024 * 1024) {
      alert("文件过大！请上传小于 5MB 的 PDF 或图片。");
      return;
    }
    
    setImportingOrg(true);
    
    let filePart = undefined;
    // Pass CSV or text content as additional text instruction to AI
    // Pass PDF or Images as inline data
    let textInstruction = importText;

    if (file) {
      if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
         const text = await file.text();
         textInstruction += `\n\n[Attached File Content]:\n${text}`;
      } else {
         const base64Data = await fileToBase64(file);
         // Infer MIME type if missing or generic, for correct Gemini processing
         let mimeType = file.type;
         if (!mimeType || mimeType === 'application/octet-stream') {
            if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (file.name.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (file.name.endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
            else if (file.name.endsWith('.pptx')) mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            else if (file.name.endsWith('.ppt')) mimeType = 'application/vnd.ms-powerpoint';
         }
         
         filePart = {
            mimeType: mimeType || 'application/pdf', // Default fallback usually safe for Gemini document processing
            data: base64Data
         };
      }
    }

    const result = await parseOrgChartToRelationships(textInstruction, users, cycle.id, filePart);
    
    // Merge new users
    if (result.newUsers && result.newUsers.length > 0) {
      const createdUsers = (result.newUsers || []).map(u => ({
        id: u.id || `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: u.name || 'New User',
        username: (u.name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        password: '123456', // Default password for AI imported users
        email: u.email || `${(u.name || 'user').toLowerCase().replace(/\s+/g, '.')}@nexus.com`,
        role: (u.role ? u.role.toUpperCase() as UserRole : UserRole.EMPLOYEE),
        department: u.department || 'Imported',
        managerId: u.managerId,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`
      }));
      setUsers([...users, ...createdUsers]);
      alert(`已成功识别并添加 ${createdUsers.length} 位新成员！(默认密码: 123456)`);
    }

    // Merge assignments
    if (result.assignments && result.assignments.length > 0) {
      setAssignments([...assignments, ...result.assignments]);
      alert(`已生成 ${result.assignments.length} 条考核关系！`);
    } else {
      alert("未能识别出有效的考核关系。请检查文件内容是否包含清晰的上下级或团队关系描述。");
    }
    
    setImportingOrg(false);
    setImportText('');
    if (fileInput) fileInput.value = '';
  };

  const handleImportUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingUsers(true);
    try {
      let filePart = null;
      
      let textContent = '';
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.type === 'text/plain') {
         textContent = await file.text();
      } else {
         const base64 = await fileToBase64(file);
         filePart = { mimeType: file.type, data: base64 };
      }

      const importedUsers = await parseUserList(filePart, textContent);
      
      if (importedUsers && importedUsers.length > 0) {
        // Current usernames set for uniqueness check
        const existingUsernames = new Set(users.map(u => u.username));
        
        const newUsers = (importedUsers || []).map(u => {
           let baseUsername = (u.name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
           let uniqueUsername = baseUsername;
           let counter = 1;
           
           // Simple duplicate resolution
           while (existingUsernames.has(uniqueUsername)) {
              uniqueUsername = `${baseUsername}${counter}`;
              counter++;
           }
           existingUsernames.add(uniqueUsername);

           return {
             id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
             name: u.name || 'Unknown',
             username: uniqueUsername,
             password: '123456', // Default password for imported users, can be batch reset later
             email: u.email || `${uniqueUsername}@nexus.com`,
             role: u.role || UserRole.EMPLOYEE,
             department: u.department || 'Imported',
             avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`
           };
        }) as User[];
        
        setUsers([...users, ...newUsers]);
        alert(`成功导入 ${newUsers.length} 名用户。(默认密码: 123456，建议使用“批量生成随机密码”重置)`);
      } else {
        alert("未能识别到有效用户数据。请检查文件格式。");
      }
    } catch (err) {
      console.error(err);
      alert("导入失败");
    } finally {
      setImportingUsers(false);
      e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    const headers = ["ID", "Reviewer Name", "Subject Name", "Relationship", "Status", "Cycle"];
    const rows = assignments.map(a => {
      const reviewer = users.find(u => u.id === a.reviewerId);
      const subject = users.find(u => u.id === a.subjectId);
      return [
        a.id,
        reviewer?.name || a.reviewerId,
        subject?.name || a.subjectId,
        a.relationship,
        a.status,
        cycle.name
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexus360_assignments_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveUser = () => {
    if (!newUser.name || !newUser.username) return;

    if (editingUserId) {
      setUsers(users.map(u => u.id === editingUserId ? { ...u, ...newUser } : u));
    } else {
      const user: User = {
        id: `u-${Date.now()}`,
        name: newUser.name,
        username: newUser.username,
        email: `${newUser.username}@nexus.com`,
        role: newUser.role as UserRole,
        department: newUser.department || 'General',
        password: newUser.password || '123456', // Set default if empty on create
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.username}`
      };
      setUsers([...users, user]);
    }
    setNewUser({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456' });
    setEditingUserId(null);
    setShowAddUser(false);
  };

  const handleDeleteUser = (userId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '删除用户确认',
      message: '确定要删除该用户吗？此操作不可撤销，且该用户相关的考核记录（自评、他评）都将被一并移除。',
      onConfirm: () => {
        // Use functional updates to prevent stale state in closure
        setUsers((prev) => prev.filter(u => u.id !== userId));
        setAssignments((prev) => prev.filter(a => a.reviewerId !== userId && a.subjectId !== userId));
        setConfirmConfig(null);
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '重置密码',
      message: '确定要将该用户的密码重置为默认密码 "123456" 吗？',
      onConfirm: () => {
        setUsers(users.map(u => u.id === userId ? { ...u, password: '123456' } : u));
        setConfirmConfig(null);
        alert("密码已重置为 123456");
      }
    });
  };

  const startEditUser = (user: User) => {
    setNewUser({
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
      password: user.password || '123456'
    });
    setEditingUserId(user.id);
    setShowAddUser(true);
  };

  const handleGenerateQuestionnaire = async () => {
    setGeneratingQ(true);
    const newQs = await generateQuestionnaire();
    if (newQs.length > 0) {
      setQuestions(newQs);
    }
    setGeneratingQ(false);
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统管理控制台</h2>
          <p className="text-sm text-slate-500">配置考核周期、用户及流程</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-sm font-bold text-slate-600">当前周期:</span>
           <input 
             value={cycle.name}
             onChange={(e) => setCycle({...cycle, name: e.target.value})}
             className="border-b border-slate-300 focus:border-blue-500 outline-none px-2 py-1 text-slate-800 font-medium w-64"
           />
           <span className="text-sm text-slate-400 ml-2">截止:</span>
           <input 
             type="date"
             value={cycle.dueDate}
             onChange={(e) => setCycle({...cycle, dueDate: e.target.value})}
             className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-600"
           />
        </div>
      </div>

      <InstructionAlert title="管理指南">
        管理员可在此配置用户、问卷及考核关系。建议按顺序进行配置：
        <ul className="list-decimal list-inside mt-1">
          <li><strong>用户管理：</strong> 导入员工名单后，请使用<strong>“批量生成随机密码”</strong>功能确保账户安全，并通过<strong>“导出账号凭证”</strong>将账号密码分发给员工。</li>
          <li><strong>考核关系设置：</strong> 可使用“一键生成”功能或通过“导入组织架构”由 AI 自动分析创建复杂的 360 度评价关系矩阵。</li>
          <li><strong>问卷设计：</strong> 利用 AI 基于公司价值观和当前考核目标，自动生成符合 SMART 原则的题库。</li>
        </ul>
      </InstructionAlert>

      {/* Sub Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['relations', 'questions', 'users'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeSubTab === tab 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'users' && '用户管理'}
            {tab === 'relations' && '准备评价者名单'}
            {tab === 'questions' && '测评试题开发'}
          </button>
        ))}
      </div>

      {activeSubTab === 'users' && (
        <Card className="p-6">
           <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-slate-800">用户列表</h3>
               <div className="flex gap-2">
                  <Button variant="primary" className="text-sm" onClick={() => {
                    setEditingUserId(null);
                    setNewUser({ name: '', username: '', role: UserRole.EMPLOYEE, department: '', password: '123456' });
                    setShowAddUser(!showAddUser);
                  }}>
                    {showAddUser ? '取消' : '+ 添加用户'}
                  </Button>
               </div>
            </div>

            {/* Batch Operations Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">批量操作:</span>
               
               <label className="cursor-pointer bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded text-sm font-medium flex items-center transition-colors">
                  <Icons.Upload /> <span className="ml-1.5">{importingUsers ? '导入中...' : '导入名单'}</span>
                  <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleImportUsers} disabled={importingUsers} />
               </label>
               
               <div className="h-6 w-px bg-slate-300 mx-1"></div>

               <Button variant="secondary" className="text-sm py-1.5" onClick={handleBatchGeneratePasswords} title="为所有用户重置随机密码">
                  <Icons.Key /> <span className="ml-1">批量生成随机密码</span>
               </Button>
               
               <Button variant="secondary" className="text-sm py-1.5" onClick={handleExportCredentials} title="导出含密码的CSV文件用于分发">
                  <Icons.Download /> <span className="ml-1">导出账号凭证 (CSV)</span>
               </Button>
            </div>
          </div>

          {showAddUser && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-slate-700 mb-3">{editingUserId ? '编辑用户' : '新增用户'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input 
                  placeholder="姓名" 
                  className="p-2 border rounded text-sm"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
                <input 
                  placeholder="用户名 (User ID)" 
                  className="p-2 border rounded text-sm"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
                <input 
                  placeholder="密码 (默认: 123456)" 
                  className="p-2 border rounded text-sm"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
                <input 
                  placeholder="部门" 
                  className="p-2 border rounded text-sm"
                  value={newUser.department}
                  onChange={e => setNewUser({...newUser, department: e.target.value})}
                />
                <div className="flex gap-2">
                   <select 
                    className="p-2 border rounded text-sm flex-1"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                   >
                     <option value={UserRole.EMPLOYEE}>员工</option>
                     <option value={UserRole.MANAGER}>经理</option>
                     <option value={UserRole.ADMIN}>管理员</option>
                   </select>
                   <Button onClick={handleSaveUser}>{editingUserId ? '更新' : '保存'}</Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">姓名</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">用户名</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">部门</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{u.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500"><Badge>{u.role}</Badge></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{u.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleResetPassword(u.id)}
                          className="text-yellow-600 hover:text-yellow-800 p-1 rounded hover:bg-yellow-50"
                          title="重置密码"
                        >
                          <Icons.Refresh />
                        </button>
                        <button onClick={() => startEditUser(u)} className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50">
                          <Icons.Edit />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)} 
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="删除用户"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeSubTab === 'relations' && (
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-white border-blue-100">
             <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">AI 智能分析并导入</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      支持上传 <strong>PDF, 图片</strong> (组织架构图)，或 <strong>CSV/Excel</strong> (花名册)。AI 将自动识别新用户并创建 360 度考核关系。
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-blue-200 rounded-lg p-4 flex flex-col justify-center items-center bg-blue-50/50 hover:bg-blue-50 transition-colors relative overflow-hidden">
                     <input 
                       id="orgChartFile" 
                       type="file" 
                       accept=".pdf, .png, .jpg, .jpeg, .csv, .txt, .xlsx, .xls, .pptx, .ppt"
                       className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10"
                       title=" "
                     />
                     <div className="pointer-events-none flex flex-col items-center">
                        <Icons.Upload />
                        <p className="text-sm text-blue-500 mt-2 font-medium">点击上传文件 (PDF, PNG, CSV, Excel)</p>
                        <p className="text-xs text-slate-400 mt-1">支持拖拽上传</p>
                     </div>
                  </div>
                  <textarea
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                    placeholder="或者在此直接粘贴文本描述..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleImportOrgChart} isLoading={importingOrg} variant="primary">
                    <Icons.Sparkles /> <span className="ml-2">开始分析并导入</span>
                  </Button>
                  <Button onClick={handleGenerateRelationships} isLoading={generatingRel} variant="secondary">
                     <span className="ml-2">仅基于现有用户生成</span>
                  </Button>
                </div>
             </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">考核关系矩阵 ({assignments.length} 条)</h3>
              <Button variant="secondary" className="text-xs" onClick={handleExportExcel}>
                导出 Excel
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">被考核人</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">考核人</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">关系</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assignments.map(a => {
                     const subject = users.find(u => u.id === a.subjectId);
                     const reviewer = users.find(u => u.id === a.reviewerId);
                     return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm font-medium text-slate-900">{subject?.name || a.subjectId}</td>
                        <td className="px-6 py-3 text-sm text-slate-600">{reviewer?.name || a.reviewerId}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">
                          <Badge color={a.relationship === 'MANAGER' ? 'red' : 'blue'}>{a.relationship}</Badge>
                        </td>
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
                  {assignments.length === 0 && (
                     <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                        暂无考核关系。请导入或生成。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSubTab === 'questions' && (
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-r from-purple-50 to-white border-purple-100">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-purple-900">AI 智能设计问卷</h3>
                <p className="text-sm text-slate-600 mt-1">
                  严格遵循：陈述句式、第三人称、单一行为点、正向描述。
                </p>
              </div>
              <Button onClick={handleGenerateQuestionnaire} isLoading={generatingQ} className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                <Icons.Sparkles /> <span className="ml-2">生成推荐问卷</span>
              </Button>
            </div>
          </Card>

          <Card className="p-6">
             <h3 className="text-lg font-bold text-slate-800 mb-6">当前问卷题目 ({questions.length})</h3>
             <div className="space-y-4">
               {questions.map((q, idx) => (
                 <div key={q.id} className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors bg-slate-50">
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm">
                     {idx + 1}
                   </div>
                   <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{q.category}</span>
                      </div>
                      <input 
                        className="w-full bg-transparent border-none p-0 text-slate-800 font-medium focus:ring-0"
                        value={q.text}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                      />
                   </div>
                   <button onClick={() => deleteQuestion(q.id)} className="text-slate-400 hover:text-red-500">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                 </div>
               ))}
             </div>
             <div className="mt-6 flex justify-center">
               <Button 
                 onClick={handleAddQuestion}
                 variant="secondary" 
                 className="w-full border-dashed border-2"
               >
                 + 添加自定义题目
               </Button>
             </div>
          </Card>
        </div>
      )}
      
      {/* Confirmation Modal Render */}
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

// --- App Component ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-reviews' | 'team-reports' | 'admin'>('dashboard');
  const [assignments, setAssignments] = useState<ReviewAssignment[]>(INITIAL_ASSIGNMENTS);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [activeCycle, setActiveCycle] = useState<ReviewCycle>(INITIAL_CYCLE);
  const [sharedReports, setSharedReports] = useState<Set<string>>(new Set());
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);

  // Derived state
  const myPendingReviews = assignments.filter(a => a.reviewerId === currentUser?.id && a.status === EvaluationStatus.PENDING);
  
  // Handlers
  const handleLogin = (username: string, password: string) => {
    const user = users.find(u => u.username === username && (u.password === password || (!u.password && password === '123456')));
    
    if (user) {
      setCurrentUser(user);
      setActiveTab('dashboard');
      setLoginError(null);
    } else {
      setLoginError('用户名或密码错误。');
    }
  };

  const handleChangePassword = (oldPwd: string, newPwd: string) => {
    if (!currentUser) return;
    
    // Check old password
    const currentActualPwd = currentUser.password || '123456';
    if (oldPwd !== currentActualPwd) {
        alert("旧密码错误！");
        return;
    }

    const updatedUser = { ...currentUser, password: newPwd };
    setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setChangePasswordOpen(false);
    alert("密码修改成功！下次登录请使用新密码。");
  };

  const handleSubmitReview = (assignmentId: string, scores: Record<string, number>, comments: Record<string, string>, feedbackStrengths: string, feedbackImprovements: string) => {
    setAssignments(prev => prev.map(a => 
      a.id === assignmentId 
        ? { ...a, status: EvaluationStatus.SUBMITTED, scores, comments, feedbackStrengths, feedbackImprovements, submittedAt: new Date().toISOString() } 
        : a
    ));
    setActiveTab('dashboard');
  };

  const toggleReportSharing = (subjectId: string) => {
    const newSet = new Set(sharedReports);
    if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
    } else {
        newSet.add(subjectId);
    }
    setSharedReports(newSet);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center space-x-2 border-b border-slate-200">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="font-bold text-lg text-white">N</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">Nexus360</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />}>
            工作台 (Dashboard)
          </NavButton>
          <NavButton active={activeTab === 'my-reviews'} onClick={() => setActiveTab('my-reviews')} icon={<Icons.List />}>
            我的待办 (Reviews)
            {myPendingReviews.length > 0 && <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{myPendingReviews.length}</span>}
          </NavButton>
          {(currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN) && (
             <NavButton active={activeTab === 'team-reports'} onClick={() => setActiveTab('team-reports')} icon={<Icons.Chart />}>
              团队报告 (Reports)
            </NavButton>
          )}
          {currentUser.role === UserRole.ADMIN && (
             <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Icons.Settings />}>
              管理后台 (Admin)
            </NavButton>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center space-x-3 mb-3">
            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-9 h-9 rounded-full border border-slate-200 bg-slate-100" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{currentUser.role === 'ADMIN' ? '管理员' : currentUser.role === 'MANAGER' ? '经理' : '员工'}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setChangePasswordOpen(true)} 
              className="flex-1 flex items-center justify-center py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              title="修改密码"
            >
               <Icons.Key /> <span className="ml-1">改密</span>
            </button>
            <button 
              onClick={() => setCurrentUser(null)} 
              className="flex-1 flex items-center justify-center py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
              title="退出登录"
            >
              退出
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-white">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">
              {activeTab === 'dashboard' && '工作概览'}
              {activeTab === 'my-reviews' && '绩效评估'}
              {activeTab === 'team-reports' && '团队数据分析'}
              {activeTab === 'admin' && '系统管理'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              当前周期: <span className="font-medium text-slate-700">{activeCycle.name}</span>
            </p>
          </div>
          <div className="hidden md:block">
            <Badge color="green">系统运行中</Badge>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard user={currentUser} users={users} assignments={assignments} setTab={setActiveTab} />}
        {activeTab === 'my-reviews' && <MyReviewsList user={currentUser} users={users} assignments={assignments} questions={questions} onSubmit={handleSubmitReview} />}
        {activeTab === 'team-reports' && <TeamReports user={currentUser} users={users} assignments={assignments} questions={questions} sharedReports={sharedReports} onToggleShare={toggleReportSharing} />}
        {activeTab === 'admin' && (
          <AdminConsole 
            users={users} 
            setUsers={setUsers}
            questions={questions} 
            setQuestions={setQuestions}
            assignments={assignments}
            setAssignments={setAssignments}
            cycle={activeCycle}
            setCycle={setActiveCycle}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={isChangePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSave={handleChangePassword}
      />
    </div>
  );
}