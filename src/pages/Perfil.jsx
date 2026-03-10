import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { User, GraduationCap, Stethoscope, LogOut } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function Perfil() {
  const { colaborador, user, logout } = useAuth();
  const [formacoes, setFormacoes] = useState([]);
  const [exames, setExames] = useState([]);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchData();
  }, [colaborador?.id]);

  async function fetchData() {
    const [formRes, examRes] = await Promise.all([
      supabase
        .from('formacoes')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data', { ascending: false })
        .limit(5),
      supabase
        .from('exames_medicos')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data', { ascending: false })
        .limit(5),
    ]);
    setFormacoes(formRes.data ?? []);
    setExames(examRes.data ?? []);
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>

      {/* Dados pessoais */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{colaborador?.nome ?? '—'}</p>
            <p className="text-sm text-gray-500">{colaborador?.categoria ?? '—'}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-700">{colaborador?.email ?? user?.email ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Formações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={18} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Formações</h2>
        </div>
        {formacoes.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem formações registadas</p>
        ) : (
          <div className="space-y-2">
            {formacoes.map(f => (
              <div key={f.id} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{f.nome}</p>
                  <p className="text-xs text-gray-400">{f.horas}h</p>
                </div>
                <span className="text-xs text-gray-500">{formatDate(f.data)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exames Médicos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope size={18} className="text-green-600" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Exames Médicos</h2>
        </div>
        {exames.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem exames registados</p>
        ) : (
          <div className="space-y-2">
            {exames.map(e => (
              <div key={e.id} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{e.tipo}</p>
                  <p className="text-xs text-gray-400">{e.resultado ?? 'Pendente'}</p>
                </div>
                <span className="text-xs text-gray-500">{formatDate(e.data)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-medium py-3 rounded-xl hover:bg-red-100 transition-colors"
      >
        <LogOut size={18} /> Terminar Sessão
      </button>
    </div>
  );
}
