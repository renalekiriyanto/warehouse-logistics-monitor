import api from '../utils/api';

export interface StdSomedayData {
  id: number;
  date_time: string;
  awb: string;
  id_driver: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface LaravelBatchInfo {
  uuid: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  processed_rows: number;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  errors?: any[] | string[];
}

export interface ImportStatusResponse {
  success: boolean;
  data: LaravelBatchInfo;
}

export interface UploadResponse {
  success: boolean;
  data: {
    uuid: string;
  };
}

export const stdSomedayService = {
  /**
   * Fetch all records from std_somedays table on Laravel API
   * Target endpoint: GET http://127.0.0.1:8000/api/std-somedays
   */
  async getAll(): Promise<StdSomedayData[]> {
    const response = await api.get('/std-somedays');
    const resData = response.data;
    if (resData && Array.isArray(resData.data)) {
      return resData.data;
    } else if (Array.isArray(resData)) {
      return resData;
    } else if (resData && typeof resData === 'object' && Array.isArray(resData.projections)) {
      return resData.projections;
    } else {
      return [];
    }
  },

  /**
   * Upload CSV or Excel file to the Laravel API as multipart/form-data with progress mapping.
   * Target endpoint: POST http://127.0.0.1:8000/api/std-somedays/upload
   */
  async upload(
    file: File, 
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/std-somedays/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });

    return response.data;
  },

  /**
   * Poll import job status from the API
   * Target endpoint: GET http://127.0.0.1:8000/api/import-batches/{uuid}
   */
  async getImportStatus(uuid: string): Promise<ImportStatusResponse> {
    const response = await api.get(`/import-batches/${uuid}`);
    return response.data;
  },

  /**
   * Reset database table on server
   * Target endpoint: POST http://127.0.0.1:8000/api/std-somedays/reset atau POST /api/std-somedays/clean
   */
  async reset(): Promise<void> {
    try {
      await api.post('/std-somedays/reset');
    } catch (e: any) {
      console.warn('POST /std-somedays/reset failed, trying DELETE fallback', e);
      try {
        await api.delete('/std-somedays');
      } catch (deleteError) {
        throw new Error('Endpoint reset tidak merespons di server.');
      }
    }
  }
};

export default stdSomedayService;
