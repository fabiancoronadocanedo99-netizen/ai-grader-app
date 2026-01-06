interface UserListProps {
  users: any[];
}

export default function UserList({ users }: UserListProps) {
  return (
    <div className="p-8 bg-[#f0f2f5] rounded-[30px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff]">
      <h2 className="text-xl font-bold text-slate-700 mb-6">👥 Usuarios Registrados</h2>
      <div className="space-y-4">
        {users.map((user) => (
          <div 
            key={user.id} 
            className="p-4 rounded-[15px] bg-[#f0f2f5] shadow-[6px_6px_12px_#d1d1d1,-6px_-6px_12px_#ffffff] flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-slate-700">{user.full_name || 'Sin nombre'}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-[#f0f2f5] shadow-[inset_4px_4px_8px_#d1d1d1,inset_-4px_-4px_8px_#ffffff] text-blue-600">
              {user.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}