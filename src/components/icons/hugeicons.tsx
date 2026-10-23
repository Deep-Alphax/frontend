/*
 * Ícones do HugeIcons usados pelo header, com o path EXATO do conjunto que o
 * arquivo de design importa (`Huge-icon/...` no Figma).
 *
 * São inline em vez de <img src="...svg"> pelo mesmo motivo dos ícones da
 * mentoria: o export do Figma fixa a cor da variante CLARA no path e o app é
 * dark. Com `currentColor` a cor passa a vir da classe do pai.
 *
 * Todos nascem num viewBox 24 com traço 1.5 — é como o conjunto é desenhado.
 * Quem consome define o tamanho por classe (`size-5`, `size-4`…).
 */

interface IconProps {
  className?: string;
}

/** Raiz do SVG — evita repetir viewBox/fill/aria em cada ícone. */
function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** `device/outline/flash` — CTA "Become a Pro". */
export function FlashIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5.22576 11.3294L12.224 2.34651C12.7713 1.64397 13.7972 2.08124 13.7972 3.01707V9.96994C13.7972 10.5305 14.1995 10.985 14.6958 10.985H18.0996C18.8729 10.985 19.2851 12.0149 18.7742 12.6706L11.776 21.6535C11.2287 22.356 10.2028 21.9188 10.2028 20.9829V14.0301C10.2028 13.4695 9.80048 13.015 9.3042 13.015H5.90035C5.12711 13.015 4.71494 11.9851 5.22576 11.3294Z" />
    </Icon>
  );
}

/** `ecommerce/outline/wallet 01` — chip de carteira. */
export function WalletIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14 3H5C3.89543 3 3 3.89543 3 5C3 6.10457 3.89543 7 5 7H18C18 6.07003 18 5.60504 17.8978 5.22354C17.6204 4.18827 16.8117 3.37962 15.7765 3.10222C15.395 3 14.93 3 14 3Z" />
      <path d="M3 5V15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15V13C21 10.1716 21 8.75736 20.1213 7.87868C19.2426 7 17.8284 7 15 7H7" />
      <path d="M21 12H19C18.535 12 18.3025 12 18.1118 12.0511C17.5941 12.1898 17.1898 12.5941 17.0511 13.1118C17 13.3025 17 13.535 17 14C17 14.465 17 14.6975 17.0511 14.8882C17.1898 15.4059 17.5941 15.8102 18.1118 15.9489C18.3025 16 18.535 16 19 16H21" />
    </Icon>
  );
}

/** `arrows/outline/direction-right 01` — chevron do chip. */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" />
    </Icon>
  );
}

/** `user/outline/user` — "My profile". */
export function UserIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001" />
      <circle cx="12" cy="6.99988" r="4" />
    </Icon>
  );
}

/*
 * Os dois abaixo são da família BULK (preenchida, dois tons) e não da de
 * traço — por isso não passam pelo `Icon` acima. O segundo tom é o MESMO path
 * com `opacity 0.4`, que é como o HugeIcons constrói o bulk. Mantendo tudo em
 * `currentColor`, uma classe de cor no pai pinta o ícone inteiro e a opacidade
 * cria o contraste sozinha.
 *
 * Exportados do próprio arquivo do Figma (`finance and payment/bulk/wallet` e
 * `.../gold`, 36×36) — não estão no pacote gratuito do HugeIcons.
 */

/** `finance and payment/bulk/wallet` — cartão "Available earnings". */
export function WalletFilledIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={className}>
      <path
        opacity="0.4"
        d="M33 9H9C5.68629 9 3 11.6863 3 15V27C3 30.3137 5.68629 33 9 33H27C30.3137 33 33 30.3137 33 27V9Z"
        fill="currentColor"
      />
      <path
        d="M33 9C33 5.68629 30.3137 3 27 3H18C14.6863 3 12 5.68629 12 9H33Z"
        fill="currentColor"
      />
      <path
        d="M3 18L3 24L9 24C10.6569 24 12 22.6569 12 21C12 19.3431 10.6569 18 9 18L3 18Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** `finance and payment/bulk/gold` — cartão "Total Earnings". */
export function GoldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12.7256 11.6526C12.8865 10.9769 13.4902 10.5 14.1848 10.5H21.8152C22.5098 10.5 23.1135 10.9769 23.2744 11.6526L25.0601 19.1526C25.2846 20.0951 24.5698 21 23.6009 21H12.3991C11.4302 21 10.7154 20.0951 10.9399 19.1526L12.7256 11.6526Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        d="M5.08844 22.7289C5.32976 21.7153 6.23537 21 7.27725 21H13.7229C14.7648 21 15.6704 21.7153 15.9117 22.7289L17.3403 28.7289C17.6769 30.1427 16.6048 31.5 15.1515 31.5H5.84868C4.39531 31.5 3.32324 30.1427 3.65987 28.7289L5.08844 22.7289Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        d="M20.0884 22.7289C20.3298 21.7153 21.2354 21 22.2773 21H28.7229C29.7648 21 30.6704 21.7153 30.9117 22.7289L32.3403 28.7289C32.6769 30.1427 31.6048 31.5 30.1515 31.5H20.8487C19.3953 31.5 18.3232 30.1427 18.6599 28.7289L20.0884 22.7289Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 3.375C18.6213 3.375 19.125 3.87868 19.125 4.5V6C19.125 6.62132 18.6213 7.125 18 7.125C17.3787 7.125 16.875 6.62132 16.875 6V4.5C16.875 3.87868 17.3787 3.375 18 3.375Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.7955 5.2045C28.2348 5.64384 28.2348 6.35616 27.7955 6.7955L26.2955 8.29549C25.8562 8.73483 25.1438 8.73483 24.7045 8.29549C24.2652 7.85616 24.2652 7.14384 24.7045 6.7045L26.2045 5.2045C26.6438 4.76517 27.3562 4.76517 27.7955 5.2045Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.2045 5.2045C8.64384 4.76517 9.35616 4.76517 9.7955 5.2045L11.2955 6.7045C11.7348 7.14384 11.7348 7.85616 11.2955 8.29549C10.8562 8.73483 10.1438 8.73483 9.7045 8.29549L8.2045 6.7955C7.76517 6.35616 7.76517 5.64384 8.2045 5.2045Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** `ecommerce/outline/voucher` — "Affiliates". */
export function VoucherIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4.56324 5.55783L7.4 7.99976M7.4 7.99976L11 10.9998M7.4 7.99976L4.50512 10.3863M7.4 7.99976L11 4.99976M2 4.49976C2 5.32818 2.67157 5.99976 3.5 5.99976C4.32843 5.99976 5 5.32818 5 4.49976C5 3.67133 4.32843 2.99976 3.5 2.99976C2.67157 2.99976 2 3.67133 2 4.49976ZM2 11.4998C2 12.3282 2.67157 12.9998 3.5 12.9998C4.32843 12.9998 5 12.3282 5 11.4998C5 10.6713 4.32843 9.99976 3.5 9.99976C2.67157 9.99976 2 10.6713 2 11.4998Z" />
      <path d="M8 15.0768V14M19.8462 7.27029C20.3409 7.41042 20.7309 7.62313 21.0537 7.94599C21.3766 8.26886 21.5893 8.65887 21.7294 9.1536M21.7294 18.8461C21.5893 19.3408 21.3766 19.7308 21.0537 20.0537C20.7309 20.3766 20.3409 20.5893 19.8462 20.7294M10.1538 20.7294C9.65913 20.5893 9.26913 20.3766 8.94627 20.0537C8.62341 19.7308 8.41071 19.3408 8.27058 18.8461M13.9231 21H16.0769M22 15.0768V12.9229M16.0769 7H13.9231" />
    </Icon>
  );
}

/** `interface/outline/logout 01` — "Sign out". */
export function LogoutIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M15.5 8.04045C15.4588 6.87972 15.3216 6.15451 14.8645 5.58671C14.2114 4.77536 13.0944 4.52064 10.8605 4.01121L9.85915 3.78286C6.4649 3.00882 4.76777 2.6218 3.63388 3.51317C2.5 4.40454 2.5 6.1257 2.5 9.56803V14.432C2.5 17.8743 2.5 19.5955 3.63388 20.4868C4.76777 21.3782 6.4649 20.9912 9.85915 20.2171L10.8605 19.9888C13.0944 19.4794 14.2114 19.2246 14.8645 18.4133C15.3216 17.8455 15.4588 17.1203 15.5 15.9595" />
      <path d="M18.5 9.01172C18.5 9.01172 21.5 11.2212 21.5 12.0117C21.5 12.8023 18.5 15.0117 18.5 15.0117M21 12.0117H8.49998" />
    </Icon>
  );
}

/** `interface/outline/copy` — copiar endereço. */
export function CopyIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7.5 14.5C7.5 11.2002 7.5 9.55025 8.52513 8.52513C9.55025 7.5 11.2002 7.5 14.5 7.5C17.7998 7.5 19.4497 7.5 20.4749 8.52513C21.5 9.55025 21.5 11.2002 21.5 14.5C21.5 17.7998 21.5 19.4497 20.4749 20.4749C19.4497 21.5 17.7998 21.5 14.5 21.5C11.2002 21.5 9.55025 21.5 8.52513 20.4749C7.5 19.4497 7.5 17.7998 7.5 14.5Z" />
      <path d="M7.5 16.5C6.10355 16.5 5.40533 16.5 4.84402 16.3036C3.83866 15.9518 3.0482 15.1613 2.69641 14.156C2.5 13.5947 2.5 12.8964 2.5 11.5V9.5C2.5 6.20017 2.5 4.55025 3.52513 3.52513C4.55025 2.5 6.20017 2.5 9.5 2.5H11.5C12.8964 2.5 13.5947 2.5 14.156 2.69641C15.1613 3.0482 15.9518 3.83866 16.3036 4.84402C16.5 5.40533 16.5 6.10355 16.5 7.5" />
    </Icon>
  );
}

/** `education/outline/pencil` — editar a carteira. */
export function PencilIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M15.2141 5.98239L16.6158 4.58063C17.39 3.80646 18.6452 3.80646 19.4194 4.58063C20.1935 5.3548 20.1935 6.60998 19.4194 7.38415L18.0176 8.78591M15.2141 5.98239L6.98023 14.2163C5.93493 15.2616 5.41226 15.7842 5.05637 16.4211C4.70047 17.058 4.3424 18.5619 4 20C5.43809 19.6576 6.94199 19.2995 7.57889 18.9436C8.21579 18.5877 8.73844 18.0651 9.78375 17.0198L18.0176 8.78591M15.2141 5.98239L18.0176 8.78591" />
      <path d="M11 20H17" />
    </Icon>
  );
}

/** `interface/outline/cancel 01` — remover a carteira. */
export function CancelIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085" />
    </Icon>
  );
}

/** `interface/outline/plus-sign` — "Connect another wallet". */
export function PlusSignIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 4V20M20 12H4" />
    </Icon>
  );
}

/**
 * Seta descendo para a bandeja (traço no estilo do conjunto, desenhado aqui —
 * sem nó no Figma) — botão "Deposit" do header e ação da linha de carteira.
 */
export function DepositIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3.5V14.5M12 14.5C11.3 14.5 8.5 11.5 8.5 11.5M12 14.5C12.7 14.5 15.5 11.5 15.5 11.5" />
      <path d="M3.5 14.5C3.5 17.33 3.5 18.74 4.38 19.62C5.26 20.5 6.67 20.5 9.5 20.5H14.5C17.33 20.5 18.74 20.5 19.62 19.62C20.5 18.74 20.5 17.33 20.5 14.5" />
    </Icon>
  );
}
