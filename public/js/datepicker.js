// Wanderlust Premium Date Range Picker Component
(() => {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const formatDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const parseDate = (str) => {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  class WanderlustDatePicker {
    constructor() {
      this.searchPanel = document.querySelector(".wl-search-panel");
      this.popover = document.getElementById("calendar-popover");
      this.checkInInput = document.getElementById("check-in-input");
      this.checkOutInput = document.getElementById("check-out-input");
      this.checkInField = document.getElementById("check-in-field");
      this.checkOutField = document.getElementById("check-out-field");

      if (!this.searchPanel || !this.popover || !this.checkInInput || !this.checkOutInput) {
        return;
      }

      // The server's date (LD9), so the calendar and the search rules agree on "today"
      const now = new Date();
      this.today =
        parseDate(this.popover.dataset.today) ||
        new Date(now.getFullYear(), now.getMonth(), now.getDate());
      this.todayStr = formatDate(this.today);

      this.startDate = this.checkInInput.value ? this.checkInInput.value : null;
      this.endDate = this.checkOutInput.value ? this.checkOutInput.value : null;
      this.hoverDate = null;

      // Start view from selected start date or today
      const initial = parseDate(this.startDate) || this.today;
      this.viewYear = initial.getFullYear();
      this.viewMonth = initial.getMonth();

      this.isOpen = false;
      this.initEvents();
    }

    initEvents() {
      // Toggle on Check In / Check Out field click
      const openPicker = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.trigger = e.currentTarget;
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      };

      // What the two fields show follows the hidden inputs the form submits
      [
        [this.checkInField, this.checkInInput],
        [this.checkOutField, this.checkOutInput],
      ].forEach(([field, input]) => {
        input.addEventListener("change", () => {
          const shown = field.querySelector("[data-date-value]");
          shown.textContent = input.value || "Add date";
          shown.classList.toggle("is-empty", !input.value);
          field.setAttribute(
            "aria-label",
            `${field.dataset.label}: ${input.value || "add date"}`,
          );
        });
      });

      // Modal while open: Tab stays inside, and the page behind cannot be reached
      this.popover.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const items = this.focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });

      if (this.checkInField) {
        this.checkInField.addEventListener("click", openPicker);
        this.checkInField.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.trigger = this.checkInField;
            this.open();
          }
        });
      }

      if (this.checkOutField) {
        this.checkOutField.addEventListener("click", openPicker);
        this.checkOutField.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.trigger = this.checkOutField;
            this.open();
          }
        });
      }

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!this.isOpen) return;
        const path = typeof e.composedPath === "function" ? e.composedPath() : [];
        if (
          path.includes(this.popover) ||
          (this.checkInField && path.includes(this.checkInField)) ||
          (this.checkOutField && path.includes(this.checkOutField)) ||
          (e.target && (this.popover.contains(e.target) || (this.checkInField && this.checkInField.contains(e.target)) || (this.checkOutField && this.checkOutField.contains(e.target))))
        ) {
          return;
        }
        this.close();
      });

      // Close on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.close();
        }
      });

      // Close on search form submission
      this.searchPanel.addEventListener("submit", () => {
        this.close();
      });

      // Window resize adaptation
      window.addEventListener("resize", () => {
        if (this.isOpen) this.render();
      });
    }

    open() {
      this.isOpen = true;
      this.popover.hidden = false;
      this.popover.classList.add("show");
      if (this.checkInField) this.checkInField.setAttribute("aria-expanded", "true");
      if (this.checkOutField) this.checkOutField.setAttribute("aria-expanded", "true");
      this.render();
      (this.popover.querySelector(".wl-cal-day.selected") || this.popover.querySelector(".wl-cal-day:not([disabled]):not(.empty)") || this.popover.querySelector("#wl-cal-next")).focus();
    }

    focusable() {
      return [
        ...this.popover.querySelectorAll("button:not([disabled])"),
      ];
    }

    close() {
      const wasOpen = this.isOpen;
      this.isOpen = false;
      this.popover.hidden = true;
      this.popover.classList.remove("show");
      this.hoverDate = null;
      if (this.checkInField) this.checkInField.setAttribute("aria-expanded", "false");
      if (this.checkOutField) this.checkOutField.setAttribute("aria-expanded", "false");
      if (wasOpen && this.popover.contains(document.activeElement)) this.trigger?.focus();
      else if (wasOpen && document.activeElement === document.body) this.trigger?.focus();
    }

    prevMonth() {
      const minMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
      const currentView = new Date(this.viewYear, this.viewMonth, 1);
      if (currentView <= minMonth) return;

      this.viewMonth--;
      if (this.viewMonth < 0) {
        this.viewMonth = 11;
        this.viewYear--;
      }
      this.render();
    }

    nextMonth() {
      this.viewMonth++;
      if (this.viewMonth > 11) {
        this.viewMonth = 0;
        this.viewYear++;
      }
      this.render();
    }

    selectDate(dateStr) {
      if (dateStr < this.todayStr) return;

      if (!this.startDate || (this.startDate && this.endDate)) {
        // Start new range
        this.startDate = dateStr;
        this.endDate = null;
        this.hoverDate = null;
        this.checkInInput.value = dateStr;
        this.checkOutInput.value = "";
        this.checkInInput.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (this.startDate && !this.endDate) {
        if (dateStr < this.startDate) {
          // Clicked earlier date, update start date
          this.startDate = dateStr;
          this.checkInInput.value = dateStr;
          this.checkInInput.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          // Complete range
          this.endDate = dateStr;
          this.hoverDate = null;
          this.checkOutInput.value = dateStr;
          this.checkOutInput.dispatchEvent(new Event("change", { bubbles: true }));
          this.render();
          return;
        }
      }
      this.render();
    }

    clearDates() {
      this.startDate = null;
      this.endDate = null;
      this.hoverDate = null;
      this.checkInInput.value = "";
      this.checkOutInput.value = "";
      this.checkInInput.dispatchEvent(new Event("change", { bubbles: true }));
      this.checkOutInput.dispatchEvent(new Event("change", { bubbles: true }));
      this.render();
    }

    selectToday() {
      this.viewYear = this.today.getFullYear();
      this.viewMonth = this.today.getMonth();
      this.selectDate(this.todayStr);
    }

    generateMonthHtml(year, month) {
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthTitle = `${MONTH_NAMES[month]} ${year}`;

      let daysHtml = "";
      // Empty offset cells
      for (let i = 0; i < firstDay; i++) {
        daysHtml += `<div class="wl-cal-day empty" aria-hidden="true"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
        const isPast = dateStr < this.todayStr;
        const isToday = dateStr === this.todayStr;
        const isStart = dateStr === this.startDate;
        const isEnd = dateStr === this.endDate;

        let inRange = false;
        if (this.startDate && this.endDate) {
          inRange = dateStr > this.startDate && dateStr < this.endDate;
        }

        let isHoverRange = false;
        if (this.startDate && !this.endDate && this.hoverDate) {
          isHoverRange = dateStr > this.startDate && dateStr <= this.hoverDate;
        }

        const classNames = ["wl-cal-day"];
        if (isPast) classNames.push("disabled");
        if (isToday) classNames.push("is-today");
        if (isStart) classNames.push("start-range", "selected");
        if (isEnd) classNames.push("end-range", "selected");
        if (inRange) classNames.push("in-range");
        if (isHoverRange) classNames.push("hover-range");

        const disabledAttr = isPast ? 'disabled aria-disabled="true"' : "";

        daysHtml += `
          <button
            type="button"
            class="${classNames.join(" ")}"
            data-date="${dateStr}"
            ${disabledAttr}
            aria-label="${dateStr}"
            aria-pressed="${isStart || isEnd}"
          >
            <span class="wl-day-num">${day}</span>
          </button>
        `;
      }

      return `
        <div class="wl-cal-month">
          <div class="wl-cal-month-name">${monthTitle}</div>
          <div class="wl-cal-weekdays">
            ${WEEKDAYS.map((w) => `<span class="wl-cal-weekday">${w}</span>`).join("")}
          </div>
          <div class="wl-cal-grid">
            ${daysHtml}
          </div>
        </div>
      `;
    }

    render() {
      // Redrawing replaces the buttons, so remember which one had focus
      const active = document.activeElement;
      const keepDate = active?.dataset?.date;
      const keepId = this.popover.contains(active) ? active.id : "";
      const isDual = window.innerWidth >= 768;
      const minMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
      const currentView = new Date(this.viewYear, this.viewMonth, 1);
      const isPrevDisabled = currentView <= minMonth;

      let month1Html = this.generateMonthHtml(this.viewYear, this.viewMonth);
      let month2Html = "";

      if (isDual) {
        let m2 = this.viewMonth + 1;
        let y2 = this.viewYear;
        if (m2 > 11) {
          m2 = 0;
          y2++;
        }
        month2Html = this.generateMonthHtml(y2, m2);
      }

      this.popover.innerHTML = `
        <div class="wl-cal-container">
          <div class="wl-cal-nav-bar d-flex align-items-center justify-content-between">
            <button
              type="button"
              class="wl-cal-nav-btn"
              id="wl-cal-prev"
              aria-label="Previous month"
              ${isPrevDisabled ? "disabled" : ""}
            >
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="wl-cal-nav-btn"
              id="wl-cal-next"
              aria-label="Next month"
            >
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="wl-cal-months d-flex gap-4">
            ${month1Html}
            ${month2Html}
          </div>

          <div class="wl-cal-footer d-flex align-items-center justify-content-between pt-3 mt-3 border-top">
            <div class="d-flex align-items-center gap-3">
              <button type="button" class="btn btn-sm wl-cal-btn-link" id="wl-cal-clear">Clear dates</button>
              <button type="button" class="btn btn-sm wl-cal-btn-link" id="wl-cal-today">Today</button>
            </div>
            <button type="button" class="btn btn-sm wl-btn-done" id="wl-cal-done">Done</button>
          </div>
        </div>
      `;

      // Attach navigation listeners
      const prevBtn = this.popover.querySelector("#wl-cal-prev");
      const nextBtn = this.popover.querySelector("#wl-cal-next");
      const clearBtn = this.popover.querySelector("#wl-cal-clear");
      const todayBtn = this.popover.querySelector("#wl-cal-today");
      const doneBtn = this.popover.querySelector("#wl-cal-done");

      if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); this.prevMonth(); });
      if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); this.nextMonth(); });
      if (clearBtn) clearBtn.addEventListener("click", (e) => { e.stopPropagation(); this.clearDates(); });
      if (todayBtn) todayBtn.addEventListener("click", (e) => { e.stopPropagation(); this.selectToday(); });
      if (doneBtn) doneBtn.addEventListener("click", (e) => { e.stopPropagation(); this.close(); });

      // Attach day selection listeners
      this.popover.querySelectorAll(".wl-cal-day:not(.disabled):not(.empty)").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectDate(btn.dataset.date);
        });

        btn.addEventListener("mouseenter", () => {
          if (this.startDate && !this.endDate) {
            this.hoverDate = btn.dataset.date;
            this.updateHoverClasses();
          }
        });
      });

      this.popover.querySelector(".wl-cal-months").addEventListener("mouseleave", () => {
        if (this.startDate && !this.endDate && this.hoverDate) {
          this.hoverDate = null;
          this.updateHoverClasses();
        }
      });

      this.restoreFocus(keepDate, keepId);
    }

    restoreFocus(date, id) {
      const target =
        (date && this.popover.querySelector(`[data-date="${date}"]`)) ||
        (id && this.popover.querySelector(`#${id}:not([disabled])`));
      if (target) target.focus();
    }

    updateHoverClasses() {
      this.popover.querySelectorAll(".wl-cal-day").forEach((btn) => {
        const d = btn.dataset.date;
        if (!d) return;
        const isHover = this.startDate && !this.endDate && this.hoverDate && d > this.startDate && d <= this.hoverDate;
        btn.classList.toggle("hover-range", Boolean(isHover));
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.wanderlustDatePicker = new WanderlustDatePicker();
  });
})();
