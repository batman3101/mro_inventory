import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { Department } from '@/types/database.types';
import * as departmentsService from '@/services/departments.service';

interface DepartmentsState {
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  fetchDepartments: () => Promise<void>;
  createDepartment: (
    data: Omit<Department, 'department_id' | 'created_at' | 'updated_at'>
  ) => Promise<Department>;
  updateDepartment: (
    id: string,
    data: Partial<Omit<Department, 'department_id' | 'created_at'>>
  ) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
}

export const useDepartmentStore = create<DepartmentsState>((set) => ({
  departments: [],
  isLoading: false,
  error: null,

  fetchDepartments: async () => {
    set({ isLoading: true, error: null });
    try {
      const departments = await departmentsService.getAllDepartments();
      set({ departments, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.departments.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createDepartment: async (data) => {
    const created = await departmentsService.createDepartment(data);
    set((state) => ({ departments: [...state.departments, created] }));
    return created;
  },

  updateDepartment: async (id, data) => {
    const updated = await departmentsService.updateDepartment(id, data);
    set((state) => ({
      departments: state.departments.map((dept) =>
        dept.department_id === id ? { ...dept, ...updated } : dept
      ),
    }));
  },

  deleteDepartment: async (id) => {
    await departmentsService.deleteDepartment(id);
    set((state) => ({
      departments: state.departments.filter((dept) => dept.department_id !== id),
    }));
  },
}));
