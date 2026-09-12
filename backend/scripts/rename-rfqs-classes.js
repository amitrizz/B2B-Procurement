const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '../../frontend/src/views/rfqs/index.tsx');
const scssPath = path.join(__dirname, '../../frontend/src/views/rfqs/rfqs.module.scss');

const mapping = {
  pr4_1: 'rfq--header-padding',
  w5_2: 'rfq--refresh-icon',
  flex_3: 'rfq--publish-container',
  w4_4: 'rfq--plus-icon',
  bgwhite_5: 'rfq--details-card',
  flex_6: 'rfq--details-header',
  textlg_7: 'rfq--details-title',
  text11px_8: 'rfq--details-number',
  px35_9: 'rfq--back-button',
  spacey6_10: 'rfq--items-container',
  p4_11: 'rfq--item-card',
  flex_12: 'rfq--item-header',
  fontbold_13: 'rfq--item-name',
  text11px_14: 'rfq--item-meta',
  spacey2_15: 'rfq--bids-container',
  text10px_16: 'rfq--bids-title',
  overflowxauto_17: 'rfq--table-wrapper',
  wfull_18: 'rfq--table',
  textgray500_19: 'rfq--table-head-row',
  pb2_20: 'rfq--th-supplier',
  pb2_21: 'rfq--th-price-material',
  pb2_22: 'rfq--th-price-no-material',
  pb2_23: 'rfq--th-delivery',
  pb2_24: 'rfq--th-action',
  borderb_25: 'rfq--table-row',
  py3_26: 'rfq--td-supplier',
  py3_27: 'rfq--td-price-mat',
  text10px_28: 'rfq--tax-label',
  py3_29: 'rfq--td-price-nomat',
  text10px_30: 'rfq--tax-label-nomat',
  py3_31: 'rfq--td-delivery',
  py3_32: 'rfq--td-action',
  textemerald600_33: 'rfq--status-accepted',
  textred600_34: 'rfq--status-rejected',
  px4_35: 'rfq--select-winner-btn',
  textxs_36: 'rfq--no-quotes',
  spacey4_37: 'rfq--list-container',
  py12_38: 'rfq--empty-state',
  flex_39: 'rfq--urgent-icon-wrapper',
  w3_40: 'rfq--urgent-icon',
  flex_41: 'rfq--stats-row',
  fontbold_42: 'rfq--stat-value',
  flex_43: 'rfq--stats-group',
  fontbold_44: 'rfq--stat-value-blue',
  flex_45: 'rfq--stats-items',
  fontbold_46: 'rfq--stat-value-dark',
  w4_47: 'rfq--spinner',
  flex_48: 'rfq--btn-content',
  w4_49: 'rfq--btn-icon',
  w4_50: 'rfq--btn-icon-alt',
  w4_51: 'rfq--btn-icon-dark',
  spacey4_52: 'rfq--seller-bids',
  py12_53: 'rfq--loading-state',
  w4_54: 'rfq--loading-spinner',
  py12_55: 'rfq--empty-bids',
  flex_56: 'rfq--urgent-badge',
  w3_57: 'rfq--urgent-badge-icon',
  pt2_58: 'rfq--bid-card-top',
  text001D4A_59: 'rfq--bid-card-title',
  flex_60: 'rfq--bid-stats',
  flex1_61: 'rfq--bid-stat-col',
  text11px_62: 'rfq--bid-stat-label',
  text16px_63: 'rfq--bid-stat-value',
  text10px_64: 'rfq--bid-stat-unit',
  w1px_65: 'rfq--divider',
  flex1_66: 'rfq--bid-stat-col-alt',
  text11px_67: 'rfq--bid-stat-label-alt',
  text16px_68: 'rfq--bid-stat-value-alt',
  text9px_69: 'rfq--bid-stat-sub',
  flex_70: 'rfq--bid-delivery',
  w4_71: 'rfq--clock-icon',
  textgray500_72: 'rfq--delivery-label',
  fontextrabold_73: 'rfq--delivery-value',
  pt3_74: 'rfq--bid-actions',
  wfull_75: 'rfq--view-details-btn',
  flex_76: 'rfq--btn-inner',
  w4_77: 'rfq--btn-inner-icon',
  w4_78: 'rfq--btn-inner-icon-alt',
  fixed_79: 'rfq--modal-overlay',
  relative_80: 'rfq--modal-content',
  textlg_81: 'rfq--modal-title',
  textxs_82: 'rfq--modal-desc',
  spacey4_83: 'rfq--modal-form',
  block_84: 'rfq--modal-label',
  wfull_85: 'rfq--modal-input',
  text10px_86: 'rfq--modal-help',
  wfull_87: 'rfq--modal-submit',
  w4_88: 'rfq--modal-spinner'
};

let tsxContent = fs.readFileSync(tsxPath, 'utf8');
let scssContent = fs.readFileSync(scssPath, 'utf8');

Object.keys(mapping).forEach(oldClass => {
  const newClass = mapping[oldClass];
  
  // Replace in SCSS: .pr4_1 { -> .rfq--header-padding {
  const scssRegex = new RegExp(`\\.${oldClass} \\{`, 'g');
  scssContent = scssContent.replace(scssRegex, `.${newClass} {`);
  
  // Replace in TSX: styles.pr4_1 -> styles['rfq--header-padding']
  const tsxRegex = new RegExp(`styles\\.${oldClass}\\b`, 'g');
  tsxContent = tsxContent.replace(tsxRegex, `styles['${newClass}']`);
});

// Also, let's rename the initial classes I didn't autogenerate to match BEM if they don't already
const existingMapping = {
  container: 'rfq--container',
  header: 'rfq--header',
  title: 'rfq--title',
  subtitle: 'rfq--subtitle',
  refreshButton: 'rfq--refresh-btn',
  refreshButtonBuyer: 'rfq--refresh-btn-buyer',
  refreshButtonSeller: 'rfq--refresh-btn-seller',
  tabsContainer: 'rfq--tabs',
  tabButton: 'rfq--tab-btn',
  tabActiveBuyer: 'rfq--tab-active-buyer',
  tabActiveSeller: 'rfq--tab-active-seller',
  tabInactive: 'rfq--tab-inactive',
  publishButton: 'rfq--publish-btn',
  card: 'rfq--card',
  cardHeader: 'rfq--card-header',
  statusPill: 'rfq--status-pill',
  statusPillBuyer: 'rfq--status-pill-buyer',
  statusPillSeller: 'rfq--status-pill-seller',
  rfqNumber: 'rfq--number',
  cardTitle: 'rfq--card-title',
  urgentBadge: 'rfq--urgent-badge',
  urgentBadgeSeller: 'rfq--urgent-badge-seller',
  propertiesRow: 'rfq--properties-row',
  actionsRow: 'rfq--actions-row',
  compareButton: 'rfq--compare-btn',
  editButton: 'rfq--edit-btn',
  dynamicStatusPill: 'rfq--dynamic-status'
};

Object.keys(existingMapping).forEach(oldClass => {
  const newClass = existingMapping[oldClass];
  
  const scssRegex = new RegExp(`\\.${oldClass} \\{`, 'g');
  scssContent = scssContent.replace(scssRegex, `.${newClass} {`);
  
  const tsxRegex = new RegExp(`styles\\.${oldClass}\\b`, 'g');
  tsxContent = tsxContent.replace(tsxRegex, `styles['${newClass}']`);
});


fs.writeFileSync(tsxPath, tsxContent);
fs.writeFileSync(scssPath, scssContent);

console.log('Renamed classes to BEM conventions.');
