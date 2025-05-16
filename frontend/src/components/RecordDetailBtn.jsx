import React from 'react'
// ボタンが押されたらその値をstateにもっていく
const RecordDetailBtn = ({cf,rec}) => {
  return (
  <button type="button" className="btn btn-outline-info" onClick={() => cf(rec)} >
    <i className="bi bi-info-circle"></i> 詳細
  </button>

  )
}

export default RecordDetailBtn

