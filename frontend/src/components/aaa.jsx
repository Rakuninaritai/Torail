import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';



const [isLoading, setLoading] = useState(false);



{isLoading && (
            
              <Skeleton
                width="100%"
                height="100%"
                style={{ display: 'block' }}
              />
           )}

// -----
import { toast } from 'react-toastify';
// 何か処理をしたあとに…
    toast.success('保存されました！', {
    });