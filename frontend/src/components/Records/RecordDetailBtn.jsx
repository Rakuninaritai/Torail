import React from 'react'
import { useNavigate } from "react-router-dom";
// ボタンが押されたらその値をstateにもっていく
const RecordDetailBtn = ({cf,rec}) => {
  const navigate = useNavigate();
  return (
  // <button type="button" className="btn btn-outline-info" onClick={() => cf(rec)} >
  <button type="button" className="btn btn-outline-info" onClick={() => navigate(`/records/${rec.id}`)} >
    <i className="bi bi-info-circle"></i> 詳細
  </button>

  )
}

export default RecordDetailBtn

