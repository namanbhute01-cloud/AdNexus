import { useParams } from 'react-router-dom';
import { DeviceDetail } from '../components/device/DeviceDetail';

export const DeviceDetailPage = () => {
  const { id = '' } = useParams();
  return <DeviceDetail deviceId={id} />;
};

