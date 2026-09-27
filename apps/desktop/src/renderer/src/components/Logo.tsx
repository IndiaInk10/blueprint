import logoUrl from '../../../../resources/logo.svg';

export const APP_NAME = 'Blueprint';

export function Logo() {
  return (
    <div className="brand">
      <img className="brand-mark" src={logoUrl} alt="" draggable={false} />
      <span className="brand-name">{APP_NAME.toUpperCase()}</span>
    </div>
  );
}
