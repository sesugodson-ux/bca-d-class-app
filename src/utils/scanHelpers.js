// File: src/utils/scanHelpers.js
import { normalizeRollNo } from './helpers';

/* Maps roll-number tokens read from the note to student ids.
   - 6+ digits  -> matched as a full roll number
   - 1-5 digits -> matched by the roll number's last digits ("1" -> "01"),
                   the same short numbers shown on the attendance grid.
   A token is "unresolved" when it matches no student or more than one.
   Students marked Left are reported separately because the grid disables them. */
export function resolveScannedRolls(tokens, studentDb, leftIds){
  const ids = [];
  const unresolved = [];
  const leftSkipped = [];
  const seen = {};

  (tokens || []).forEach(function(raw){
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
    if(!digits) return;

    let candidates;
    if(digits.length >= 6){
      candidates = studentDb.filter(function(s){
        return s.name !== 'XX' && normalizeRollNo(s.rollNo) === digits;
      });
    } else {
      const suffix = digits.length === 1 ? '0' + digits : digits;
      candidates = studentDb.filter(function(s){
        return s.name !== 'XX' && String(s.rollNo).trim().slice(-suffix.length) === suffix;
      });
    }

    if(candidates.length !== 1){ unresolved.push(String(raw).trim()); return; }

    const student = candidates[0];
    if(seen[student.id]) return; // same number written twice
    seen[student.id] = true;

    if(leftIds.indexOf(student.id) !== -1){ leftSkipped.push(student.rollNo); return; }
    ids.push(student.id);
  });

  return { ids, unresolved, leftSkipped };
}