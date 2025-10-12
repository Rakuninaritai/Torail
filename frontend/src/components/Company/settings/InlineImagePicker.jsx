import React, { useRef } from "react";

export default function InlineImagePicker({ value, onChange, label="ロゴ" }) {
  const inputRef = useRef(null);
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange?.({ file, previewUrl: url });
  };
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="d-flex align-items-center gap-3">
        <div style={{width:64,height:64, borderRadius:12, border:"1px solid #e5e7eb", display:"grid", placeItems:"center", overflow:"hidden", background:"#fff"}}>
          {value?.previewUrl || value?.url ? (
            <img src={value.previewUrl || value.url} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}} />
          ) : (
            <i className="bi bi-image text-muted" />
          )}
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={()=>inputRef.current?.click()}>
            <i className="bi bi-upload" /> 画像を選択
          </button>
          { (value?.previewUrl || value?.url) && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={()=>onChange?.(null)}>
              <i className="bi bi-trash" /> クリア
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="d-none" onChange={onFile} />
    </div>
  );
}
