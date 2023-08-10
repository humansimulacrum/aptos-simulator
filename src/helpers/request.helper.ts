import axios, { AxiosError } from 'axios';

export async function sendGetRequest(url: string): Promise<any> {
  let retryCount = 0;

  while (retryCount < 10) {
    try {
      const response = await axios.get(url);
      const data = response.data;
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.code === 'ETIMEDOUT') {
        console.error(`Connection timed out. Retrying request (${retryCount + 1}/10)...`);
        retryCount++;
      } else {
        console.error(error);
        throw error;
      }
    }
  }

  throw new Error('Failed to make the request after 10 attempts');
}

function isAxiosError(error: any): error is AxiosError {
  return error.isAxiosError !== undefined;
}
