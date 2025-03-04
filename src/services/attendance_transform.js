/**
 * This file contains the implementation for transforming attendance_managment sheet data
 * to be integrated into the etlService.js file
 */

// Copy and paste this implementation into etlService.js
// after the holiday_master_details processing section, before the writeFile call

// Process attendance_managment sheet if it exists (note the spelling in the Excel sheet)
if (
  data.attendance_managment &&
  data.attendance_managment.length >= 3
) {
  // Headers are in the second row (index 1)
  const headers = data.attendance_managment[1];

  // Track created attendance settings to avoid duplicates
  const createdAttendanceSettings = {};

  // Process each attendance management row starting from index 2 (skipping header rows)
  for (
    let rowIndex = 2;
    rowIndex < data.attendance_managment.length;
    rowIndex++
  ) {
    const attendanceData = data.attendance_managment[rowIndex];

    // Create a map of header to value for easier access
    const attendanceDataMap = {};
    headers.forEach((header, index) => {
      if (header) {
        attendanceDataMap[header] = attendanceData[index];
      }
    });

    // Skip if required fields are missing
    if (
      !attendanceDataMap.shift_type ||
      !attendanceDataMap.module_code
    )
      continue;

    // Generate unique IDs
    const id = generateDeterministicUUID(
      attendanceDataMap.shift_type || "",
      attendanceDataMap.capture_method || ""
    );

    const orgId = generateDeterministicUUID(
      attendanceDataMap.auth_signatory_designation || "",
      attendanceDataMap.cin || ""
    );

    const moduleId = generateDeterministicUUID(
      attendanceDataMap.module_code || "",
      attendanceDataMap.module_category || ""
    );

    const createdById = generateDeterministicUUID(
      attendanceDataMap.created_by_emp_number || "",
      attendanceDataMap.created_by_emp_first_name || ""
    );

    const updatedById = generateDeterministicUUID(
      attendanceDataMap.updated_by_emp_number || "",
      attendanceDataMap.updated_by_emp_first_name || ""
    );

    // Check if this attendance setting has been processed already
    if (!createdAttendanceSettings[id]) {
      createdAttendanceSettings[id] = true;

      // Convert boolean fields
      let geoFencingEnabled = attendanceDataMap.geo_fencing_enabled;
      if (geoFencingEnabled === "TRUE" || geoFencingEnabled === "true") {
        geoFencingEnabled = true;
      } else if (geoFencingEnabled === "FALSE" || geoFencingEnabled === "false") {
        geoFencingEnabled = false;
      } else {
        geoFencingEnabled = null;
      }

      let overtimePolicyEnabled = attendanceDataMap.overtime_policy_enabled;
      if (overtimePolicyEnabled === "TRUE" || overtimePolicyEnabled === "true") {
        overtimePolicyEnabled = true;
      } else if (overtimePolicyEnabled === "FALSE" || overtimePolicyEnabled === "false") {
        overtimePolicyEnabled = false;
      } else {
        overtimePolicyEnabled = null;
      }

      let autoCheckoutEnabled = attendanceDataMap.auto_checkout_enabled;
      if (autoCheckoutEnabled === "TRUE" || autoCheckoutEnabled === "true") {
        autoCheckoutEnabled = true;
      } else if (autoCheckoutEnabled === "FALSE" || autoCheckoutEnabled === "false") {
        autoCheckoutEnabled = false;
      } else {
        autoCheckoutEnabled = null;
      }

      let regularizationAllowed = attendanceDataMap.regularization_allowed;
      if (regularizationAllowed === "TRUE" || regularizationAllowed === "true") {
        regularizationAllowed = true;
      } else if (regularizationAllowed === "FALSE" || regularizationAllowed === "false") {
        regularizationAllowed = false;
      } else {
        regularizationAllowed = null;
      }

      // Convert numeric fields
      const geoFenceRadius = parseInt(attendanceDataMap.geo_fence_radius) || null;
      const gracePeriodMinutes = parseInt(attendanceDataMap.grace_period_minutes) || null;
      const halfDayHours = parseInt(attendanceDataMap.half_day_hours) || null;
      const fullDayHours = parseFloat(attendanceDataMap.full_day_hours) || null;
      const breakDurationMinutes = parseInt(attendanceDataMap.break_duration_minutes) || null;
      const workDaysPerWeek = parseInt(attendanceDataMap.work_days_per_week) || null;
      const minimumOvertimeMinutes = parseInt(attendanceDataMap.minimum_overtime_minutes) || null;
      const maxOvertimeHoursMonthly = parseInt(attendanceDataMap.max_overtime_hours_monthly) || null;
      const regularizationWindowDays = parseInt(attendanceDataMap.regularization_window_days) || null;
      const regularizationLimitMonthly = parseInt(attendanceDataMap.regularization_limit_monthly) || null;
      const weekendOvertimeMultiplier = parseFloat(attendanceDataMap.weekend_overtime_multiplier) || null;
      const holidayOvertimeMultiplier = parseFloat(attendanceDataMap.holiday_overtime_multiplier) || null;
      const flexibleHours = parseInt(attendanceDataMap.flexible_hours) || null;

      // Create attendance setting object
      const attendanceSettingObj = {
        id: id,
        org_id: orgId,
        module_id: moduleId,
        capture_method: attendanceDataMap.capture_method || "",
        geo_fencing_enabled: geoFencingEnabled,
        geo_fence_radius: geoFenceRadius,
        shift_type: attendanceDataMap.shift_type || "",
        shift_start_time: attendanceDataMap.shift_start_time || null,
        shift_end_time: attendanceDataMap.shift_end_time || null,
        flexible_hours: flexibleHours,
        grace_period_minutes: gracePeriodMinutes,
        half_day_hours: halfDayHours,
        full_day_hours: fullDayHours,
        break_duration_minutes: breakDurationMinutes,
        work_days_per_week: workDaysPerWeek,
        overtime_policy_enabled: overtimePolicyEnabled,
        minimum_overtime_minutes: minimumOvertimeMinutes,
        overtime_calculation_type: attendanceDataMap.overtime_calculation_type || null,
        max_overtime_hours_monthly: maxOvertimeHoursMonthly,
        late_penalty_type: attendanceDataMap.late_penalty_type || "",
        late_penalty_leave_type: attendanceDataMap.late_penalty_leave_type || null,
        missing_swipe_policy: attendanceDataMap.missing_swipte_policy || "", // Note: there's a typo in the field name
        auto_checkout_enabled: autoCheckoutEnabled,
        auto_checkout_time: attendanceDataMap.auto_checkout_time || null,
        regularization_allowed: regularizationAllowed,
        regularization_window_days: regularizationWindowDays,
        regularization_limit_monthly: regularizationLimitMonthly,
        weekend_overtime_multiplier: weekendOvertimeMultiplier,
        holiday_overtime_multiplier: holidayOvertimeMultiplier,
        created_by: createdById,
        updated_by: updatedById,
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      // Debug log to verify the object has all required fields
      console.log(
        "Attendance Setting Object:",
        JSON.stringify(attendanceSettingObj, null, 2)
      );

      transformedData.push(attendanceSettingObj);
    }
  }
}
