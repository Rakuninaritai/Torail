import React from 'react'
import { useNavigate } from 'react-router-dom';
const Home = ({token}) => {
  const navigate = useNavigate();
  return (
    <div  id="home">
      <h1><i className="bi bi-house-door"></i> ホーム</h1>
      <p className="lead">ようこそ!Torail.Appへ。</p>
      <p className="lead">試作段階です。</p>
      <p className="lead">会員登録・ログインとデータの登録・閲覧・編集・削除ができます。</p>
      <p className="lead">ご利用にはログイン/会員登録が必要です。</p>
      <div className="d-flex justify-content-center gap-3 mt-3">
        {!token&&(<button type='button'  className="btn btn-dark btn-md" onClick={()=>navigate('/login_register')}   >ログイン/会員登録はこちら</button>)}
        
        </div>
    </div>
  )
}

export default Home